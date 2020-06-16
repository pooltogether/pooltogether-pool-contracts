pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@pooltogether/governor-contracts/contracts/GovernorInterface.sol";
import "@nomiclabs/buidler/console.sol";

import "../token/TokenControllerInterface.sol";
import "../token/ControlledToken.sol";
import "./PeriodicPrizePoolInterface.sol";
import "../prize-strategy/PrizeStrategyInterface.sol";
import "../rng/RNGInterface.sol";
import "../Constants.sol";
import "./Timelock.sol";
import "../ticket/Ticket.sol";

/* solium-disable security/no-block-members */
abstract contract PeriodicPrizePool is Timelock, BaseRelayRecipient, ReentrancyGuardUpgradeSafe, PeriodicPrizePoolInterface, IERC777Recipient, TokenControllerInterface {
  using SafeMath for uint256;

  uint256 internal constant ETHEREUM_BLOCK_TIME_ESTIMATE_MANTISSA = 13.4 ether;

  event PrizePoolOpened(address indexed operator, uint256 indexed prizePeriodStartedAt);
  event PrizePoolAwardStarted(address indexed operator, uint256 indexed rngRequestId);
  event PrizePoolAwardCompleted(address indexed operator, uint256 prize, uint256 reserveFee, bytes32 randomNumber);

  event TicketsRedeemedWithTimelock(
    address indexed operator,
    address indexed from,
    uint256 tickets,
    uint256 unlockTimestamp,
    bytes data,
    bytes operatorData
  );

  event TicketsRedeemedInstantly(
    address indexed operator,
    address indexed from,
    uint256 tickets,
    uint256 exitFee,
    bytes data,
    bytes operatorData
  );

  PrizeStrategyInterface public override prizeStrategy;
  GovernorInterface governor;
  RNGInterface public rng;
  Ticket public ticket;
  ControlledToken public sponsorship;
  ControlledToken public ticketCredit;
  ControlledToken public sponsorshipCredit;

  uint256 public override prizePeriodSeconds;
  uint256 public override prizePeriodStartedAt;
  uint256 public previousPrize;
  uint256 public previousPrizeAverageTickets;
  uint256 public prizeAverageTickets;
  uint256 public feeScaleMantissa;
  uint256 public rngRequestId;
  mapping(address => uint256) ticketInterestShares;

  function initialize (
    address _trustedForwarder,
    GovernorInterface _governor,
    PrizeStrategyInterface _prizeStrategy,
    RNGInterface _rng,
    uint256 _prizePeriodSeconds
  ) public initializer {
    require(address(_governor) != address(0), "governor cannot be zero");
    require(address(_prizeStrategy) != address(0), "prize strategy must not be zero");
    require(_prizePeriodSeconds > 0, "prize period must be greater than zero");
    require(address(_rng) != address(0), "rng cannot be zero");
    trustedForwarder = _trustedForwarder;
    __ReentrancyGuard_init();
    governor = _governor;
    prizeStrategy = _prizeStrategy;
    rng = _rng;
    prizePeriodSeconds = _prizePeriodSeconds;
    Constants.REGISTRY.setInterfaceImplementer(address(this), Constants.TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
    prizePeriodStartedAt = currentTime();
    emit PrizePoolOpened(_msgSender(), prizePeriodStartedAt);
  }

  function setTokens(
    Ticket _ticket,
    ControlledToken _sponsorship,
    ControlledToken _ticketCredit,
    ControlledToken _sponsorshipCredit
  ) external {
    require(address(ticket) == address(0), "already initialized");
    require(address(_ticket) != address(0), "ticket cannot be zero");
    require(address(_sponsorship) != address(0), "sponsorship cannot be zero");
    require(address(_ticketCredit) != address(0), "ticketCredit cannot be zero");
    require(address(_sponsorshipCredit) != address(0), "sponsorshipCredit cannot be zero");
    ticket = _ticket;
    sponsorship = _sponsorship;
    ticketCredit = _ticketCredit;
    sponsorshipCredit = _sponsorshipCredit;
  }

  function currentPrize() public override returns (uint256) {
    uint256 balance = _unaccountedBalance();
    uint256 reserveFee = calculateReserveFee(balance);
    return balance.sub(reserveFee);
  }

  function calculateExitFee(uint256 tickets, uint256 userInterestRatio) public view override returns (uint256) {
    return scaleValueByTimeRemaining(
      _calculateExitFeeWithValues(
        userInterestRatio,
        tickets,
        previousPrizeAverageTickets,
        previousPrize
      ),
      _prizePeriodRemainingSeconds(),
      prizePeriodSeconds
    );
  }

  function _calculateExitFeeWithValues(
    uint256 _userInterestRatioMantissa,
    uint256 _tickets,
    uint256 _previousPrizeAverageTickets,
    uint256 _previousPrize
  ) internal pure returns (uint256) {
    // If there were no tickets, then it doesn't matter
    if (_previousPrizeAverageTickets == 0) {
      return 0;
    }
    // user needs to collateralize their tickets the same as the previous prize.
    uint256 interestRatioMantissa = FixedPoint.calculateMantissa(_previousPrize, _previousPrizeAverageTickets);
    if (_userInterestRatioMantissa >= interestRatioMantissa) {
      return 0;
    }
    uint256 interestRatioDifferenceMantissa = interestRatioMantissa - _userInterestRatioMantissa;
    return FixedPoint.multiplyUintByMantissa(_tickets, interestRatioDifferenceMantissa);
  }

  function scaleValueByTimeRemaining(uint256 _value, uint256 _timeRemainingSeconds, uint256 _prizePeriodSeconds) internal pure returns (uint256) {
    return FixedPoint.multiplyUintByMantissa(
      _value,
      FixedPoint.calculateMantissa(
        _timeRemainingSeconds < _prizePeriodSeconds ? _timeRemainingSeconds : _prizePeriodSeconds,
        _prizePeriodSeconds
      )
    );
  }

  function calculateReserveFee(uint256 amount) internal view returns (uint256) {
    if (governor.reserve() == address(0) || governor.reserveFeeMantissa() == 0) {
      return 0;
    }
    return FixedPoint.multiplyUintByMantissa(amount, governor.reserveFeeMantissa());
  }

  function calculateUnlockTimestamp(address, uint256) public view override returns (uint256) {
    return prizePeriodEndAt();
  }

  function estimatePrize() public override returns (uint256) {
    return estimatePrizeWithBlockTime(ETHEREUM_BLOCK_TIME_ESTIMATE_MANTISSA);
  }

  function estimatePrizeWithBlockTime(uint256 secondsPerBlockFixedPoint18) public override returns (uint256) {
    return currentPrize().add(estimateRemainingPrizeWithBlockTime(secondsPerBlockFixedPoint18));
  }

  function estimateRemainingPrize() public view override returns (uint256) {
    return estimateRemainingPrizeWithBlockTime(ETHEREUM_BLOCK_TIME_ESTIMATE_MANTISSA);
  }

  function estimateRemainingPrizeWithBlockTime(uint256 secondsPerBlockFixedPoint18) public view override returns (uint256) {
    uint256 remaining = _estimateAccruedInterestOverBlocks(
      _accountedBalance(),
      estimateRemainingBlocksToPrize(secondsPerBlockFixedPoint18)
    );
    uint256 reserveFee = calculateReserveFee(remaining);
    return remaining.sub(reserveFee);
  }

  function estimateRemainingBlocksToPrize(uint256 secondsPerBlockFixedPoint18) public view returns (uint256) {
    return FixedPoint.divideUintByMantissa(
      _prizePeriodRemainingSeconds(),
      secondsPerBlockFixedPoint18
    );
  }

  function prizePeriodRemainingSeconds() public view override returns (uint256) {
    return _prizePeriodRemainingSeconds();
  }

  function _prizePeriodRemainingSeconds() internal view returns (uint256) {
    uint256 endAt = prizePeriodEndAt();
    uint256 time = currentTime();
    if (time > endAt) {
      return 0;
    } else {
      return endAt - time;
    }
  }

  function isPrizePeriodOver() public view returns (bool) {
    return currentTime() >= prizePeriodEndAt();
  }

  function isRngRequested() public view returns (bool) {
    return rngRequestId != 0;
  }

  function isRngCompleted() public view returns (bool) {
    return rng.isRequestComplete(rngRequestId);
  }

  function canStartAward() public view override returns (bool) {
    return isPrizePeriodOver() && !isRngRequested();
  }

  function canCompleteAward() public view override returns (bool) {
    return isRngRequested() && isRngCompleted();
  }

  function mintedTickets(uint256 amount) public override {
    uint256 scaledTickets = scaleValueByTimeRemaining(
      amount,
      _prizePeriodRemainingSeconds(),
      prizePeriodSeconds
    );
    prizeAverageTickets = prizeAverageTickets.add(
      scaledTickets
    );
  }

  function redeemedTickets(uint256 amount) public override {
    prizeAverageTickets = prizeAverageTickets.sub(
      scaleValueByTimeRemaining(
        amount,
        _prizePeriodRemainingSeconds(),
        prizePeriodSeconds
      )
    );
  }

  function startAward() public override requireCanStartAward nonReentrant {
    rngRequestId = rng.requestRandomNumber(address(0),0);

    emit PrizePoolAwardStarted(_msgSender(), rngRequestId);
  }

  function completeAward() public override requireCanCompleteAward nonReentrant {
    uint256 balance = captureInterest();
    uint256 reserveFee = calculateReserveFee(balance);
    uint256 prize = balance.sub(reserveFee);

    if (balance > 0) {
      if (reserveFee > 0) {
        sponsorship.mint(governor.reserve(), reserveFee, "", "");
      }
      if (prize > 0) {
        _mintTickets(address(prizeStrategy), prize, "", "");
      }
    }

    bytes32 randomNumber = rng.randomNumber(rngRequestId);
    prizePeriodStartedAt = currentTime();
    prizeStrategy.award(uint256(randomNumber), prize);

    previousPrize = prize;
    previousPrizeAverageTickets = prizeAverageTickets;
    prizeAverageTickets = ticket.totalSupply();
    rngRequestId = 0;

    emit PrizePoolAwardCompleted(_msgSender(), prize, reserveFee, randomNumber);
  }

  function prizePeriodEndAt() public view override returns (uint256) {
    // current prize started at is non-inclusive, so add one
    return prizePeriodStartedAt + prizePeriodSeconds;
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

  function currentTime() internal virtual view returns (uint256) {
    return block.timestamp;
  }

  modifier requireCanStartAward() {
    require(isPrizePeriodOver(), "prize period not over");
    require(!isRngRequested(), "rng has already been requested");
    _;
  }

  modifier requireCanCompleteAward() {
    require(isRngRequested(), "no rng request has been made");
    require(isRngCompleted(), "rng request has not completed");
    _;
  }

  modifier notRequestingRN() {
    require(rngRequestId == 0, "rng request is in flight");
    _;
  }

  function mintTickets(address to, uint256 amount, bytes calldata data) external nonReentrant {
    _token().transferFrom(_msgSender(), address(this), amount);
    _supply(amount);
    _mintTickets(to, amount, data, "");
    mintedTickets(amount);
  }

  function _mintTickets(address to, uint256 amount, bytes memory data, bytes memory operatorData) internal {
    // Mint tickets
    ticket.mint(to, amount, data, operatorData);
    _mintTicketInterestShares(to, amount);
  }

  function _mintTicketInterestShares(address to, uint256 amount) internal {
    uint256 shares = supplyCollateral(amount);
    ticketInterestShares[to] = ticketInterestShares[to].add(shares);
  }

  function operatorRedeemTicketsInstantly(
    address from,
    uint256 tickets,
    bytes calldata data,
    bytes calldata operatorData
  ) external nonReentrant returns (uint256) {
    uint256 userInterestRatioMantissa = _ticketInterestRatioMantissa(from);
    uint256 exitFee = calculateExitFee(tickets, userInterestRatioMantissa);

    // transfer the fee to this contract
    _token().transferFrom(_msgSender(), address(this), exitFee);

    // burn the tickets
    _burnTickets(from, tickets, data, operatorData);
    // burn the interestTracker
    _redeemTicketInterestShares(from, tickets, userInterestRatioMantissa);

    // redeem the tickets less the fee
    uint256 amount = tickets.sub(exitFee);
    _redeem(amount);
    _token().transfer(from, amount);

    emit TicketsRedeemedInstantly(_msgSender(), from, tickets, exitFee, data, operatorData);

    // return the exit fee
    return exitFee;
  }

  function interestRatioMantissa(address user) public returns (uint256) {
    return _ticketInterestRatioMantissa(user);
  }

  function balanceOfTicketInterest(address user) public returns (uint256) {
    uint256 tickets = ticket.balanceOf(user);
    return _balanceOfTicketInterest(user, tickets);
  }

  function _balanceOfTicketInterest(address user, uint256 tickets) internal returns (uint256) {
    uint256 ticketsPlusInterest = collateralValueOfShares(ticketInterestShares[user]);
    uint256 interest;
    if (ticketsPlusInterest >= tickets) {
      interest = ticketsPlusInterest.sub(tickets);
    }
    return interest;
  }

  function _ticketInterestRatioMantissa(address user) internal returns (uint256) {
    uint256 tickets = ticket.balanceOf(user);
    return FixedPoint.calculateMantissa(_balanceOfTicketInterest(user, tickets), tickets);
  }

  function redeemTicketsInstantly(uint256 tickets, bytes calldata data) external nonReentrant returns (uint256) {
    address sender = _msgSender();
    uint256 userInterestRatioMantissa = _ticketInterestRatioMantissa(sender);


    uint256 exitFee = calculateExitFee(
      tickets,
      userInterestRatioMantissa
    );



    // burn the tickets
    _burnTickets(sender, tickets, data, "");


    // now calculate how much interest needs to be redeemed to maintain the interest ratio
    _redeemTicketInterestShares(sender, tickets, userInterestRatioMantissa);

    uint256 ticketsLessFee = tickets.sub(exitFee);


    // redeem the interestTracker less the fee
    _redeem(ticketsLessFee);
    _token().transfer(sender, ticketsLessFee);

    emit TicketsRedeemedInstantly(sender, sender, tickets, exitFee, data, "");

    // return the exit fee
    return exitFee;
  }

  function _redeemTicketInterestShares(address sender, uint256 tickets, uint256 userInterestRatioMantissa) internal {
    uint256 ticketInterest = FixedPoint.multiplyUintByMantissa(tickets, userInterestRatioMantissa);
    uint256 burnedShares = redeemCollateral(tickets.add(ticketInterest));
    ticketInterestShares[sender] = ticketInterestShares[sender].sub(burnedShares);
    ticketCredit.mint(sender, ticketInterest, "", "");
  }

  function operatorRedeemTicketsWithTimelock(
    address from,
    uint256 tickets,
    bytes calldata data,
    bytes calldata operatorData
  ) external nonReentrant returns (uint256) {
    return _redeemTicketsWithTimelock(_msgSender(), from, tickets, data, operatorData);
  }

  function redeemTicketsWithTimelock(uint256 tickets, bytes calldata data) external nonReentrant returns (uint256) {
    address sender = _msgSender();
    return _redeemTicketsWithTimelock(sender, sender, tickets, data, "");
  }

  function _redeemTicketsWithTimelock(
    address operator,
    address sender,
    uint256 tickets,
    bytes memory data,
    bytes memory operatorData
  ) internal returns (uint256) {
    // burn the tickets
    require(ticket.balanceOf(sender) >= tickets, "Insufficient balance");
    _burnTickets(sender, tickets, data, operatorData);

    uint256 unlockTimestamp = calculateUnlockTimestamp(sender, tickets);

    // Sweep the old balance, if any
    address[] memory senders = new address[](1);
    senders[0] = sender;
    sweep(senders);

    mintTo(sender, tickets, unlockTimestamp);

    emit TicketsRedeemedWithTimelock(operator, sender, tickets, unlockTimestamp, data, operatorData);

    // if the funds should already be unlocked
    if (unlockTimestamp <= block.timestamp) {
      sweep(senders);
    }

    // return the block at which the funds will be available
    return unlockTimestamp;
  }

  function _burnTickets(address from, uint256 tickets, bytes memory data, bytes memory operatorData) internal {
    ticket.burn(from, tickets, data, operatorData);
    redeemedTickets(tickets);
  }

  function mintTicketsWithSponsorshipTo(address to, uint256 amount) public {
    _mintTicketsWithSponsorship(to, amount);
  }

  function _mintTicketsWithSponsorship(address to, uint256 amount) internal {
    // Transfer sponsorship
    sponsorship.transferFrom(_msgSender(), address(this), amount);

    // Mint draws
    _mintTickets(to, amount, "", "");
  }

  function balanceOfInterestShares(address user) public view returns (uint256) {
    return ticketInterestShares[user];
  }

  function _msgSender() internal override(BaseRelayRecipient, ContextUpgradeSafe) virtual view returns (address payable) {
    return BaseRelayRecipient._msgSender();
  }

  function beforeTokenTransfer(address operator, address from, address to, uint256 amount) external override {
    // handle transfers of tickets, sponsorship, credits etc

    // transfers of credits are ignored
    if (msg.sender == address(ticket)) {
      beforeTicketTransfer(operator, from, to, amount);
    } else if (msg.sender == address(sponsorship)) {
      beforeSponsorshipTransfer(operator, from, to, amount);
    }
  }

  function beforeTicketTransfer(address, address from, address to, uint256 amount) internal {
    // minting and burning are handled elsewhere
    if (from == address(0) || to == address(0)) {
      return;
    }

    // otherwise we need to transfer the collateral from one user to the other
    // the from's collateralization will increase, so credit them
    uint256 fromTicketInterestRatio = _ticketInterestRatioMantissa(from);
    _redeemTicketInterestShares(from, amount, fromTicketInterestRatio);
    _mintTicketInterestShares(to, amount);
  }

  function beforeSponsorshipTransfer(address operator, address from, address to, uint256 amount) internal {
    // minting and burning are handled elsewhere
    if (from == address(0) || to == address(0)) {
      return;
    }

    // otherwise do the business here
  }

  function balanceOfTicketInterestShares(address user) public view returns (uint256) {
    return ticketInterestShares[user];
  }
}
