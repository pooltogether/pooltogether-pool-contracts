pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";

import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@pooltogether/governor-contracts/contracts/GovernorInterface.sol";
import "sortition-sum-tree-factory/contracts/SortitionSumTreeFactory.sol";
import "@pooltogether/uniform-random-number/contracts/UniformRandomNumber.sol";

import "./PrizeStrategyStorage.sol";
import "../token/TokenControllerInterface.sol";
import "../token/ControlledToken.sol";
import "../prize-pool/PrizeStrategyInterface.sol";
import "../prize-pool/PrizePool.sol";
import "../Constants.sol";

/* solium-disable security/no-block-members */
contract PrizeStrategy is PrizeStrategyStorage,
                          Initializable,
                          OwnableUpgradeSafe,
                          BaseRelayRecipient,
                          ReentrancyGuardUpgradeSafe,
                          PrizeStrategyInterface,
                          IERC777Recipient,
                          TokenControllerInterface {

  using SafeMath for uint256;
  using SafeCast for uint256;
  using SortitionSumTreeFactory for SortitionSumTreeFactory.SortitionSumTrees;
  using MappedSinglyLinkedList for MappedSinglyLinkedList.Mapping;

  bytes32 constant private TREE_KEY = keccak256("PoolTogether/Ticket");
  uint256 constant private MAX_TREE_LEAVES = 5;
  uint256 internal constant ETHEREUM_BLOCK_TIME_ESTIMATE_MANTISSA = 13.4 ether;

  event PrizePoolOpened(address indexed operator, uint256 indexed prizePeriodStartedAt);
  event PrizePoolAwardStarted(address indexed operator, address indexed prizePool, uint256 indexed rngRequestId);
  event PrizePoolAwarded(address indexed operator, uint256 prize, uint256 reserveFee);

  function initialize (
    address _trustedForwarder,
    GovernorInterface _governor,
    uint256 _prizePeriodSeconds,
    PrizePool _prizePool,
    address _ticket,
    address _sponsorship,
    RNGInterface _rng,
    address[] memory _externalAwards
  ) public initializer {
    require(address(_governor) != address(0), "PrizeStrategy/governor-not-zero");
    require(_prizePeriodSeconds > 0, "PrizeStrategy/prize-period-greater-than-zero");
    require(address(_prizePool) != address(0), "PrizeStrategy/prize-pool-zero");
    require(address(_ticket) != address(0), "PrizeStrategy/ticket-not-zero");
    require(address(_sponsorship) != address(0), "PrizeStrategy/sponsorship-not-zero");
    require(address(_rng) != address(0), "PrizeStrategy/rng-not-zero");
    prizePool = _prizePool;
    ticket = IERC20(_ticket);
    rng = _rng;
    sponsorship = IERC20(_sponsorship);
    trustedForwarder = _trustedForwarder;
    __Ownable_init();
    __ReentrancyGuard_init();
    governor = _governor;
    prizePeriodSeconds = _prizePeriodSeconds;
    Constants.REGISTRY.setInterfaceImplementer(address(this), Constants.TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
    prizePeriodStartedAt = _currentTime();
    sortitionSumTrees.createTree(TREE_KEY, MAX_TREE_LEAVES);
    externalAwardMapping.initialize(_externalAwards);
    for (uint256 i = 0; i < _externalAwards.length; i++) {
      require(prizePool.canAwardExternal(_externalAwards[i]), "PrizeStrategy/cannot-award-external");
    }

    emit PrizePoolOpened(_msgSender(), prizePeriodStartedAt);
  }

  function draw(uint256 randomNumber) public view returns (address) {
    uint256 bound = ticket.totalSupply();
    address selected;
    if (bound == 0) {
      selected = address(0);
    } else {
      uint256 token = UniformRandomNumber.uniform(randomNumber, bound);
      selected = address(uint256(sortitionSumTrees.draw(TREE_KEY, token)));
    }
    return selected;
  }

  /// @notice Accrues ticket credit for a user.
  /// @param user The user for whom to accrue credit
  function accrueTicketCredit(address user) public {
    _accrueTicketCredit(user, ticket.balanceOf(user));
  }

  /// @notice Accrues ticket credit for a user assuming their current balance is the passed balance.
  /// @param user The user for whom to accrue credit
  /// @param balance The balance to use for the user
  function _accrueTicketCredit(address user, uint256 balance) internal {
    uint256 credit = calculateAccruedCredit(user, balance);
    creditBalances[user] = CreditBalance({
      credit: uint256(creditBalances[user].credit).add(uint256(credit)).toUint128(),
      interestIndex: uint128(prizePool.interestIndexMantissa())
    });
  }

  /// @notice Calculates the accrued interest for a user
  /// @param user The user whose credit should be calculated.
  /// @param ticketBalance The current balance of the user's tickets.
  /// @return The amount of accrued credit
  function calculateAccruedCredit(address user, uint256 ticketBalance) internal returns (uint256) {
    uint256 interestIndex = prizePool.interestIndexMantissa();
    uint256 userIndex = creditBalances[user].interestIndex;// ticketIndexMantissa[user];
    if (userIndex == 0) {
      // if the index is not intialized
      userIndex = interestIndex;
    }

    uint256 iTokens = FixedPoint.divideUintByMantissa(ticketBalance, userIndex);
    uint256 currentValue = FixedPoint.multiplyUintByMantissa(iTokens, interestIndex);

    uint256 newTickets;
    if (currentValue > ticketBalance) {
      newTickets = currentValue.sub(ticketBalance);
    }

    return newTickets;
  }

  function currentPrize() public returns (uint256) {
    uint256 balance = prizePool.awardBalance();
    uint256 reserveFee = _calculateReserveFee(balance);
    return balance.sub(reserveFee);
  }

  function beforeWithdrawInstantlyFrom(address from, uint256 amount, address controlledToken) external override returns (uint256) {
    return _calculateInstantWithdrawalFee(from, amount, controlledToken);
  }

  /// @notice Calculates the instant withdrawal fee for a user, and burns the credit consumed.
  /// @param from The user who is withdrawing
  /// @param amount The amount of collateral they are withdrawing
  /// @param token The token they are withdrawing (i.e. sponsorship or ticket)
  /// @return The additional fee the the user needs to pay.  Credit is taken into account.
  function _calculateInstantWithdrawalFee(address from, uint256 amount, address token) internal returns (uint256) {
    if (token == address(ticket)) {
      _accrueTicketCredit(from, ticket.balanceOf(from));
      uint256 totalFee = _calculateExpectedInterest(amount);
      uint256 feeCredit = _calculateFeeCredit(from, totalFee);
      uint256 actualFee = totalFee.sub(feeCredit);
      if (feeCredit > 0) {
        creditBalances[from].credit = uint256(creditBalances[from].credit).sub(feeCredit).toUint128();
      }
      return actualFee;
    }
    return 0;
  }

  /// @notice Calculates how much of a fee can be covered by the user's credit
  /// @param user The user whose credit should be checked
  /// @param fee The fee we are trying to cover
  /// @return The amount of the fee that credit can cover
  function _calculateFeeCredit(address user, uint256 fee) internal view returns (uint256) {
    uint256 credit = uint256(creditBalances[user].credit);
    uint256 feeCredit;
    if (credit >= fee) {
      feeCredit = fee;
    } else {
      feeCredit = credit;
    }
    return feeCredit;
  }

  /// @notice Calculates the withdrawal unlock timestamp by estimated how long it would take to pay off the exit fee.
  /// This function also accrues their ticket credit.
  /// @param user The user who wishes to withdraw
  /// @param controlledToken The token they are withdrawing
  /// @return timestamp The absolute timestamp after which they are allowed to withdraw
  function beforeWithdrawWithTimelockFrom(address user, uint256 amount, address controlledToken) external override returns (uint256 timestamp) {
    if (controlledToken == address(sponsorship)) {
      return 0;
    } else if (controlledToken == address(ticket)) {
      uint256 remainingFee = _calculateInstantWithdrawalFee(user, amount, controlledToken);
      if (remainingFee > 0) {
        // calculate how long it would take to accrue
        timestamp = _currentTime().add(
          _estimateAccrualTime(amount, remainingFee, previousPrize, previousPrizeAverageTickets, prizePeriodSeconds)
        );
      }
      return timestamp;
    }
  }

  /// @notice Estimates the amount of time it will take for a given amount of funds to accrue the given amount of interest based on the previous prize.
  /// @param _principal The principal amount on which interest is accruing
  /// @param _interest The amount of interest that must accrue
  /// @param _previousPrize The size of the previous prize
  /// @param _previousPrizeAverageTickets The number of tickets held during the previous prize
  /// @param _prizePeriodSeconds The duration of the prize
  /// @return durationSeconds The duration of time it will take to accrue the given amount of interest, in seconds.
  function estimateAccrualTime(
    uint256 _principal,
    uint256 _interest,
    uint256 _previousPrize,
    uint256 _previousPrizeAverageTickets,
    uint256 _prizePeriodSeconds
  )
    external
    pure
    returns (uint256 durationSeconds)
  {
    return _estimateAccrualTime(
      _principal,
      _interest,
      _previousPrize,
      _previousPrizeAverageTickets,
      _prizePeriodSeconds
    );
  }

  /// @notice Estimates the amount of time it will take for a given amount of funds to accrue the given amount of interest based on the previous prize.
  /// @param _principal The principal amount on which interest is accruing
  /// @param _interest The amount of interest that must accrue
  /// @param _previousPrize The size of the previous prize
  /// @param _previousPrizeAverageTickets The number of tickets held during the previous prize
  /// @param _prizePeriodSeconds The duration of the prize
  /// @return durationSeconds The duration of time it will take to accrue the given amount of interest, in seconds.
  function _estimateAccrualTime(
    uint256 _principal,
    uint256 _interest,
    uint256 _previousPrize,
    uint256 _previousPrizeAverageTickets,
    uint256 _prizePeriodSeconds
  )
    internal
    pure
    returns (uint256 durationSeconds)
  {

    // Let's assume that prevPrize = interestRatePerSecond * prizePeriodSeconds * prevPrizeTickets
    // solving for interestRatePerSecond = prevPrize / (prizePeriodSeconds * prevPrizeTickets)

    // Now solve for the prizePeriodSeconds:
    // interestRatePerSecond = prevPrize / (prizePeriodSeconds * prevPrizeTickets)
    // prizePeriodSeconds = prevPrize / (interestRatePerSecond * prevPrizeTickets)

    if (_previousPrizeAverageTickets == 0) {
      return 0;
    }

    uint256 interestRatePerSecondMantissa = FixedPoint.calculateMantissa(_previousPrize, _prizePeriodSeconds.mul(_previousPrizeAverageTickets));

    uint256 denominator = FixedPoint.multiplyUintByMantissa(_principal, interestRatePerSecondMantissa);
    uint256 durationSecondsMantissa = FixedPoint.divideUintByMantissa(_interest, denominator);

    return durationSecondsMantissa.div(FixedPoint.SCALE);
  }

  /// @notice Calculates the interest per ticket accrued for the previous prize.
  /// @param _previousPrizeAverageTickets The number of tickets for the previous prize
  /// @param _previousPrize The size of the previous prize
  /// @return interestPerTicketMantissa The interest that was earned per ticket for the last prize.
  function _calculatePreviousPrizeTicketCollateralization(
    uint256 _previousPrizeAverageTickets,
    uint256 _previousPrize
  ) internal pure returns (uint256 interestPerTicketMantissa) {
    // If there were no tickets, then it has a collateralization of zero
    if (_previousPrizeAverageTickets == 0) {
      return 0;
    }

    return FixedPoint.calculateMantissa(_previousPrize, _previousPrizeAverageTickets);
  }

  /// @notice Calculates the interest that should have accrued on the given amount of tickets
  /// @param _tickets The tickets whose interest should be calculated
  /// @return interest The interest that should have accrued on the tickets
  function _calculateExpectedInterest(
    uint256 _tickets
  )
    internal view returns (uint256 interest)
  {
    // user needs to have accrued at least as much interest as required by the tickets
    uint256 ticketCollateralizationMantissa = _calculatePreviousPrizeTicketCollateralization(previousPrizeAverageTickets, previousPrize);
    return FixedPoint.multiplyUintByMantissa(_tickets, ticketCollateralizationMantissa);
  }

  /// @notice Scales a value by a fraction being the remaining time out of the prize period.  I.e. when there are 0 seconds left, it's zero.
  /// When there are remaining == prize period seconds left it's 1.
  /// @param _value The value to scale
  /// @param _timeRemainingSeconds The time remaining in the prize period.
  /// @param _prizePeriodSeconds The length of the prize period in seconds.
  /// @return scaledValue The value scaled the time fraction
  function _scaleValueByTimeRemaining(
    uint256 _value,
    uint256 _timeRemainingSeconds,
    uint256 _prizePeriodSeconds
  )
    internal pure returns (uint256 scaledValue)
  {
    return FixedPoint.multiplyUintByMantissa(
      _value,
      FixedPoint.calculateMantissa(
        _timeRemainingSeconds < _prizePeriodSeconds ? _timeRemainingSeconds : _prizePeriodSeconds,
        _prizePeriodSeconds
      )
    );
  }

  function _calculateReserveFee(uint256 amount) internal view returns (uint256) {
    if (governor.reserve() == address(0) || governor.reserveFeeMantissa() == 0) {
      return 0;
    }
    return FixedPoint.multiplyUintByMantissa(amount, governor.reserveFeeMantissa());
  }

  function estimatePrize() public returns (uint256) {
    return estimatePrizeWithBlockTime(ETHEREUM_BLOCK_TIME_ESTIMATE_MANTISSA);
  }

  function estimatePrizeWithBlockTime(uint256 secondsPerBlockFixedPoint18) public returns (uint256) {
    return currentPrize().add(estimateRemainingPrizeWithBlockTime(secondsPerBlockFixedPoint18));
  }

  function estimateRemainingPrize() public view returns (uint256) {
    return estimateRemainingPrizeWithBlockTime(ETHEREUM_BLOCK_TIME_ESTIMATE_MANTISSA);
  }

  function estimateRemainingPrizeWithBlockTime(uint256 secondsPerBlockFixedPoint18) public view returns (uint256) {
    uint256 remaining = prizePool.estimateAccruedInterestOverBlocks(
      prizePool.accountedBalance(),
      estimateRemainingBlocksToPrize(secondsPerBlockFixedPoint18)
    );
    uint256 reserveFee = _calculateReserveFee(remaining);
    return remaining.sub(reserveFee);
  }

  function estimateRemainingBlocksToPrize(uint256 secondsPerBlockFixedPoint18) public view returns (uint256) {
    return FixedPoint.divideUintByMantissa(
      _prizePeriodRemainingSeconds(),
      secondsPerBlockFixedPoint18
    );
  }

  function prizePeriodRemainingSeconds() public view returns (uint256) {
    return _prizePeriodRemainingSeconds();
  }

  function _prizePeriodRemainingSeconds() internal view returns (uint256) {
    uint256 endAt = _prizePeriodEndAt();
    uint256 time = _currentTime();
    if (time > endAt) {
      return 0;
    }
    return endAt.sub(time);
  }

  function _mintedTickets(uint256 amount) internal {
    uint256 scaledTickets = _scaleValueByTimeRemaining(
      amount,
      _prizePeriodRemainingSeconds(),
      prizePeriodSeconds
    );
    prizeAverageTickets = prizeAverageTickets.add(
      scaledTickets
    );
  }

  function isPrizePeriodOver() external view returns (bool) {
    return _isPrizePeriodOver();
  }

  function _isPrizePeriodOver() internal view returns (bool) {
    return _currentTime() >= _prizePeriodEndAt();
  }

  function awardSponsorship(address user, uint256 amount) internal {
    prizePool.award(user, amount, address(sponsorship));
  }

  function awardTickets(address user, uint256 amount) internal {
    _accrueTicketCredit(user, ticket.balanceOf(user));
    prizePool.award(user, amount, address(ticket));
  }

  function awardExternalTokens(address winner) internal {
    address currentToken = externalAwardMapping.addressMap[MappedSinglyLinkedList.SENTINAL_TOKEN];
    while (currentToken != address(0) && currentToken != MappedSinglyLinkedList.SENTINAL_TOKEN) {
      prizePool.award(winner, IERC20(currentToken).balanceOf(address(prizePool)), currentToken);
      currentToken = externalAwardMapping.addressMap[currentToken];
    }
  }

  function prizePeriodEndAt() external view returns (uint256) {
    // current prize started at is non-inclusive, so add one
    return _prizePeriodEndAt();
  }

  function _prizePeriodEndAt() internal view returns (uint256) {
    // current prize started at is non-inclusive, so add one
    return prizePeriodStartedAt.add(prizePeriodSeconds);
  }

  function beforeTokenTransfer(address from, address to, uint256 amount, address token) external override onlyPrizePool {
    if (token == address(ticket)) {
      _requireNotLocked();
      if (from != address(0)) {
        uint256 fromBalance = ticket.balanceOf(from).sub(amount);

        _accrueTicketCredit(from, fromBalance);
        sortitionSumTrees.set(TREE_KEY, fromBalance, bytes32(uint256(from)));
      }

      if (to != address(0)) {
        uint256 toBalance = ticket.balanceOf(to).add(amount);

        _accrueTicketCredit(to, toBalance);
        sortitionSumTrees.set(TREE_KEY, toBalance, bytes32(uint256(to)));
      }
    }
  }

  function afterDepositTo(address to, uint256 amount, address token) external override onlyPrizePool requireNotLocked {
    if (token == address(ticket)) {
      uint256 toBalance = ticket.balanceOf(to);
      _accrueTicketCredit(to, toBalance.sub(amount));
      _mintedTickets(amount);
      sortitionSumTrees.set(TREE_KEY, toBalance, bytes32(uint256(to)));
    }
  }

  function afterWithdrawWithTimelockFrom(address from, uint256, address token) external override onlyPrizePool requireNotLocked {
    if (token == address(ticket)) {
      uint256 fromBalance = ticket.balanceOf(from);
      sortitionSumTrees.set(TREE_KEY, fromBalance, bytes32(uint256(from)));
    }
  }

  function afterWithdrawInstantlyFrom(
    address,
    address from,
    uint256,
    address token,
    uint256,
    uint256
  ) external override onlyPrizePool requireNotLocked {
    if (token == address(ticket)) {
      uint256 fromBalance = ticket.balanceOf(from);
      sortitionSumTrees.set(TREE_KEY, fromBalance, bytes32(uint256(from)));
    }
  }

  function afterSweepTimelockedWithdrawal(address operator, address from, uint256 amount) external override {
  }

  function _currentTime() internal virtual view returns (uint256) {
    return block.timestamp;
  }

  /// @notice Returns the credit balance for a given user.  Not that this includes both minted credit and pending credit.
  /// @param user The user whose credit balance should be returned
  /// @return creditBalance The balance of the users credit
  function balanceOfCredit(address user) external returns (uint256 creditBalance) {
    _accrueTicketCredit(user, ticket.balanceOf(user));
    return uint256(creditBalances[user].credit);
  }

  function _msgSender() internal override(BaseRelayRecipient, ContextUpgradeSafe) virtual view returns (address payable) {
    return BaseRelayRecipient._msgSender();
  }

  function beforeTokenTransfer(address from, address to, uint256 amount) external override {
    // ignore
  }

  function startAward() external requireCanStartAward {
    rngRequestId = rng.requestRandomNumber(address(0),0);

    emit PrizePoolAwardStarted(_msgSender(), address(prizePool), rngRequestId);
  }

  function completeAward() external requireCanCompleteAward {
    require(_isPrizePeriodOver(), "PrizeStrategy/not-over");
    bytes32 randomNumber = rng.randomNumber(rngRequestId);
    uint256 balance = prizePool.awardBalance();
    uint256 reserveFee = _calculateReserveFee(balance);
    uint256 prize = balance.sub(reserveFee);

    delete rngRequestId;
    prizePeriodStartedAt = _currentTime();
    previousPrize = prize;
    previousPrizeAverageTickets = prizeAverageTickets;
    prizeAverageTickets = ticket.totalSupply();

    if (reserveFee > 0) {
      awardSponsorship(governor.reserve(), reserveFee);
    }

    address winner = draw(uint256(randomNumber));
    if (winner != address(0)) {
      awardTickets(winner, prize);
      awardExternalTokens(winner);
    }

    emit PrizePoolAwarded(_msgSender(), prize, reserveFee);
    emit PrizePoolOpened(_msgSender(), prizePeriodStartedAt);
  }

  function emergencyShutdown() external onlyOwner {
    prizePool.detachPrizeStrategy();
  }

  modifier requireCanStartAward() {
    require(_isPrizePeriodOver(), "PrizeStrategy/prize-period-not-over");
    require(!isRngRequested(), "PrizeStrategy/rng-already-requested");
    _;
  }

  modifier requireCanCompleteAward() {
    require(isRngRequested(), "PrizeStrategy/rng-not-requested");
    require(isRngCompleted(), "PrizeStrategy/rng-not-complete");
    _;
  }

  modifier requireNotLocked() {
    _requireNotLocked();
    _;
  }

  modifier onlyPrizePool() {
    require(_msgSender() == address(prizePool), "PrizeStrategy/only-prize-pool");
    _;
  }

  function _requireNotLocked() internal view {
    require(rngRequestId == 0, "PrizeStrategy/rng-in-flight");
  }

  function canStartAward() external view returns (bool) {
    return _isPrizePeriodOver() && !isRngRequested();
  }

  function canCompleteAward() external view returns (bool) {
    return isRngRequested() && isRngCompleted();
  }

  function isRngRequested() public view returns (bool) {
    return rngRequestId != 0;
  }

  function isRngCompleted() public view returns (bool) {
    return rng.isRequestComplete(rngRequestId);
  }

  function tokensReceived(
    address operator,
    address from,
    address to,
    uint256 amount,
    bytes calldata userData,
    bytes calldata operatorData
  ) external override {
  }

}
