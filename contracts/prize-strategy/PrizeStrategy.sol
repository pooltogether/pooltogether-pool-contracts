pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@pooltogether/governor-contracts/contracts/GovernorInterface.sol";
import "sortition-sum-tree-factory/contracts/SortitionSumTreeFactory.sol";
import "@pooltogether/uniform-random-number/contracts/UniformRandomNumber.sol";
import "@nomiclabs/buidler/console.sol";

import "./PrizeStrategyStorage.sol";
import "../token/TokenControllerInterface.sol";
import "../token/ControlledToken.sol";
import "../prize-pool/ComptrollerInterface.sol";
import "../prize-pool/PrizePool.sol";
import "../Constants.sol";

/* solium-disable security/no-block-members */
contract PrizeStrategy is PrizeStrategyStorage,
                          Initializable,
                          BaseRelayRecipient,
                          ReentrancyGuardUpgradeSafe,
                          ComptrollerInterface,
                          IERC777Recipient,
                          TokenControllerInterface {

  using SafeMath for uint256;
  using SortitionSumTreeFactory for SortitionSumTreeFactory.SortitionSumTrees;

  bytes32 constant private TREE_KEY = keccak256("PoolTogether/Ticket");
  uint256 constant private MAX_TREE_LEAVES = 5;
  uint256 internal constant ETHEREUM_BLOCK_TIME_ESTIMATE_MANTISSA = 13.4 ether;

  event PrizePoolOpened(address indexed operator, uint256 indexed prizePeriodStartedAt);
  event PrizePoolAwardStarted(address indexed operator, address indexed prizePool, uint256 indexed rngRequestId);
  event PrizePoolAwarded(address indexed operator, uint256 prize, uint256 reserveFee);
  event SponsorshipInterestMinted(address indexed operator, address indexed to, uint256 amount);
  event SponsorshipInterestBurned(address indexed operator, address indexed from, uint256 amount);
  event Awarded(address indexed operator, address indexed winner, address indexed token, uint256 amount);

  function initialize (
    address _trustedForwarder,
    GovernorInterface _governor,
    uint256 _prizePeriodSeconds,
    PrizePool _prizePool,
    ControlledToken _ticket,
    ControlledToken _sponsorship,
    RNGInterface _rng
  ) public initializer {
    require(address(_governor) != address(0), "PrizePool/governor-not-zero");
    require(_prizePeriodSeconds > 0, "PrizePool/prize-period-greater-than-zero");
    require(address(_prizePool) != address(0), "PrizePool/prize-pool-zero");
    require(address(_ticket) != address(0), "PrizePool/ticket-not-zero");
    require(address(_sponsorship) != address(0), "PrizePool/sponsorship-not-zero");
    require(address(_rng) != address(0), "PrizePool/rng-not-zero");
    prizePool = _prizePool;
    ticket = _ticket;
    rng = _rng;
    sponsorship = _sponsorship;
    trustedForwarder = _trustedForwarder;
    __ReentrancyGuard_init();
    governor = _governor;
    prizePeriodSeconds = _prizePeriodSeconds;
    Constants.REGISTRY.setInterfaceImplementer(address(this), Constants.TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
    prizePeriodStartedAt = _currentTime();
    sortitionSumTrees.createTree(TREE_KEY, MAX_TREE_LEAVES);

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

  function accrueTicketCredit(address user) public {
    _accrueTicketCredit(user, ticket.balanceOf(user));
  }

  function _accrueTicketCredit(address user, uint256 balance) internal {
    uint256 credit = calculateNewTicketCredit(user, balance);
    creditBalances[user] = CreditBalance({
      credit: uint128(creditBalances[user].credit + credit),
      interestIndex: uint128(prizePool.interestIndexMantissa())
    });
  }

  function calculateNewTicketCredit(address user, uint256 ticketBalance) internal returns (uint256) {
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

  function calculateInstantWithdrawalFee(address from, uint256 amount, address token) external override returns (uint256) {
    if (token == address(ticket)) {
      uint256 totalFee = _calculateExitFee(amount);
      uint256 totalCredit = _balanceOfTicketCredit(from);
      uint256 burnAmount;
      uint256 fee;
      if (totalCredit >= totalFee) {
        burnAmount = totalFee;
      } else {
        burnAmount = totalCredit;
        fee = totalFee.sub(totalCredit);
      }
      _accrueTicketCredit(from, ticket.balanceOf(from));
      if (burnAmount > 0) {
        creditBalances[from].credit = creditBalances[from].credit - uint128(burnAmount);
      }
      return fee;
    }
    return 0;
  }

  function calculateWithdrawalUnlockTimestamp(address, uint256, address token) external override returns (uint256) {
    if (token == address(sponsorship)) {
      return 0;
    } else if (token == address(ticket)) {
      return _prizePeriodEndAt();
    }
  }

  function _balanceOfTicketCredit(address user) internal returns (uint256) {
    return creditBalances[user].credit + calculateNewTicketCredit(user, ticket.balanceOf(user));
  }

  function _calculateExitFee(uint256 tickets) internal view returns (uint256) {
    return _scaleValueByTimeRemaining(
      _calculateExitFeeWithValues(
        tickets,
        previousPrizeAverageTickets,
        previousPrize
      ),
      _prizePeriodRemainingSeconds(),
      prizePeriodSeconds
    );
  }

  function _calculateExitFeeWithValues(
    uint256 _tickets,
    uint256 _previousPrizeAverageTickets,
    uint256 _previousPrize
  )
    internal pure returns (uint256)
  {
    // If there were no tickets, then it doesn't matter
    if (_previousPrizeAverageTickets == 0) {
      return 0;
    }

    // user needs to have accrued at least as much interest as required by the tickets
    uint256 interestRatioMantissa = FixedPoint.calculateMantissa(_previousPrize, _previousPrizeAverageTickets);
    return  FixedPoint.multiplyUintByMantissa(_tickets, interestRatioMantissa);
  }

  function _scaleValueByTimeRemaining(
    uint256 _value,
    uint256 _timeRemainingSeconds,
    uint256 _prizePeriodSeconds
  )
    internal pure returns (uint256)
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
    return endAt - time;
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

  function awardPrize() internal returns (uint256) {
    require(_isPrizePeriodOver(), "PrizePool/not-over");
    uint256 balance = prizePool.awardBalance();
    uint256 reserveFee = _calculateReserveFee(balance);
    uint256 prize = balance.sub(reserveFee);

    prizePeriodStartedAt = _currentTime();
    previousPrize = prize;
    previousPrizeAverageTickets = prizeAverageTickets;
    prizeAverageTickets = ticket.totalSupply();

    if (reserveFee > 0) {
      sponsorship.controllerMint(governor.reserve(), reserveFee);
    }

    emit PrizePoolAwarded(_msgSender(), prize, reserveFee);
    emit PrizePoolOpened(_msgSender(), prizePeriodStartedAt);

    return prize;
  }

  function awardTickets(address user, uint256 amount) internal {
    _accrueTicketCredit(user, ticket.balanceOf(user));
    prizePool.award(user, amount, address(ticket));
  }

  function awardSponsorship(address user, uint256 amount) internal {
    prizePool.award(user, amount, address(sponsorship));
  }

  function prizePeriodEndAt() external view returns (uint256) {
    // current prize started at is non-inclusive, so add one
    return _prizePeriodEndAt();
  }

  function _prizePeriodEndAt() internal view returns (uint256) {
    // current prize started at is non-inclusive, so add one
    return prizePeriodStartedAt + prizePeriodSeconds;
  }

  function beforeTokenTransfer(address from, address to, uint256 amount, address token) external override {
    if (token == address(ticket)) {
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

  function afterDepositTo(address to, uint256 amount, address token) external override {
    if (token == address(ticket)) {
      uint256 toBalance = ticket.balanceOf(to);
      _accrueTicketCredit(to, toBalance.sub(amount));
      _mintedTickets(amount);
      sortitionSumTrees.set(TREE_KEY, toBalance, bytes32(uint256(to)));
    }
  }

  function afterWithdrawWithTimelockFrom(address from, uint256, address token) external override {
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
  ) external override {
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

  //
  // Ticket Minting/Redeeming
  //

  function balanceOfTicketInterest(address user) public returns (uint256) {
    return _balanceOfTicketCredit(user);
  }

  function _msgSender() internal override virtual view returns (address payable) {
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
    // console.log("completeing awaward 2");
    bytes32 randomNumber = rng.randomNumber(rngRequestId);
    // console.log("completeing awaward 3");
    uint256 prize = awardPrize();
    // console.log("completeing awaward 4 %s", prize);
    delete rngRequestId;
    if (prize > 0) {
      address winner = draw(uint256(randomNumber));
      if (winner != address(0)) {
        awardTickets(winner, prize);
      }
    }
  }

  modifier requireCanStartAward() {
    require(_isPrizePeriodOver(), "prize period not over");
    require(!isRngRequested(), "rng has already been requested");
    _;
  }

  modifier requireCanCompleteAward() {
    require(isRngRequested(), "no rng request has been made");
    require(isRngCompleted(), "rng request has not completed");
    _;
  }

  function canStartAward() public view returns (bool) {
    return _isPrizePeriodOver() && !isRngRequested();
  }

  function canCompleteAward() public view returns (bool) {
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
