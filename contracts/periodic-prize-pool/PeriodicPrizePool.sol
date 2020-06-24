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
import "../Constants.sol";
import "./Timelock.sol";
import "../ticket/Ticket.sol";

/* solium-disable security/no-block-members */
abstract contract PeriodicPrizePool is Timelock, BaseRelayRecipient, ReentrancyGuardUpgradeSafe, PeriodicPrizePoolInterface, IERC777Recipient, TokenControllerInterface {
  using SafeMath for uint256;

  uint256 internal constant ETHEREUM_BLOCK_TIME_ESTIMATE_MANTISSA = 13.4 ether;

  event PrizePoolOpened(address indexed operator, uint256 indexed prizePeriodStartedAt);
  event PrizePoolAwarded(address indexed operator, uint256 prize, uint256 reserveFee);

  event TicketsRedeemedWithTimelock(
    address indexed operator,
    address indexed from,
    uint256 tickets,
    uint256 unlockTimestamp
  );

  event TicketsRedeemedInstantly(
    address indexed operator,
    address indexed from,
    uint256 tickets,
    uint256 exitFee
  );

  event SponsorshipSupplied(address indexed operator, address indexed to, uint256 amount);
  event SponsorshipRedeemed(address indexed operator, address indexed from, uint256 amount);
  event SponsorshipInterestMinted(address indexed operator, address indexed to, uint256 amount);
  event SponsorshipInterestBurned(address indexed operator, address indexed from, uint256 amount);

  event Awarded(address indexed operator, address indexed winner, address indexed token, uint256 amount);

  address public override prizeStrategy;
  GovernorInterface public governor;
  Ticket internal __ticket;
  ControlledToken public sponsorship;
  ControlledToken public ticketCredit;
  ControlledToken public sponsorshipCredit;

  uint256 public override prizePeriodSeconds;
  uint256 public override prizePeriodStartedAt;
  uint256 internal previousPrize;
  uint256 internal previousPrizeAverageTickets;
  uint256 internal prizeAverageTickets;
  uint256 internal feeScaleMantissa;
  uint256 internal rngRequestId;
  mapping(address => uint256) internal ticketInterestShares;
  mapping(address => uint256) internal sponsorshipInterestShares;
  uint256 public prizeStrategyBalance;

  function initialize (
    address _trustedForwarder,
    GovernorInterface _governor,
    address _prizeStrategy,
    uint256 _prizePeriodSeconds
  ) public initializer {
    require(address(_governor) != address(0), "PrizePool/governor-not-zero");
    require(address(_prizeStrategy) != address(0), "PrizePool/prize-strategy-not-zero");
    require(_prizePeriodSeconds > 0, "PrizePool/prize-period-greater-than-zero");
    trustedForwarder = _trustedForwarder;
    __ReentrancyGuard_init();
    governor = _governor;
    prizeStrategy = _prizeStrategy;
    prizePeriodSeconds = _prizePeriodSeconds;
    Constants.REGISTRY.setInterfaceImplementer(address(this), Constants.TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
    prizePeriodStartedAt = _currentTime();
    emit PrizePoolOpened(_msgSender(), prizePeriodStartedAt);
  }

  function setTokens(
    Ticket _ticket,
    ControlledToken _sponsorship,
    ControlledToken _ticketCredit,
    ControlledToken _sponsorshipCredit
  ) external {
    require(address(__ticket) == address(0), "PrizePool/init-twice");
    require(address(_ticket) != address(0), "PrizePool/ticket-not-zero");
    require(address(_sponsorship) != address(0), "PrizePool/sponsorship-not-zero");
    require(address(_ticketCredit) != address(0), "PrizePool/ticket-credit-not-zero");
    require(address(_sponsorshipCredit) != address(0), "PrizePool/sponsorship-credit-not-zero");
    __ticket = _ticket;
    sponsorship = _sponsorship;
    ticketCredit = _ticketCredit;
    sponsorshipCredit = _sponsorshipCredit;
  }

  function currentPrize() public override returns (uint256) {
    uint256 balance = _unaccountedBalance();
    uint256 reserveFee = _calculateReserveFee(balance);
    return balance.sub(reserveFee);
  }

  function calculateExitFee(uint256 tickets, uint256 userInterestRatio) public view override returns (uint256) {
    return _scaleValueByTimeRemaining(
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
  )
    internal pure returns (uint256)
  {
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

  function calculateUnlockTimestamp(address, uint256) public view override returns (uint256) {
    return _prizePeriodEndAt();
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
    uint256 reserveFee = _calculateReserveFee(remaining);
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

  function _redeemedTickets(uint256 amount) internal {
    prizeAverageTickets = prizeAverageTickets.sub(
      _scaleValueByTimeRemaining(
        amount,
        _prizePeriodRemainingSeconds(),
        prizePeriodSeconds
      )
    );
  }

  function isPrizePeriodOver() external override view returns (bool) {
    return _isPrizePeriodOver();
  }

  function _isPrizePeriodOver() internal view returns (bool) {
    return _currentTime() >= _prizePeriodEndAt();
  }

  function ticket() external override view returns (TicketInterface) {
    return __ticket;
  }

  function awardPrize() external override onlyPrizeStrategy returns (uint256) {
    require(_isPrizePeriodOver(), "PrizePool/not-over");
    uint256 balance = captureInterest();
    uint256 reserveFee = _calculateReserveFee(balance);
    uint256 prize = balance.sub(reserveFee);
    prizeStrategyBalance = prizeStrategyBalance.add(prize);

    prizePeriodStartedAt = _currentTime();
    previousPrize = prize;
    previousPrizeAverageTickets = prizeAverageTickets;
    prizeAverageTickets = __ticket.totalSupply();

    if (reserveFee > 0) {
      sponsorship.controllerMint(governor.reserve(), reserveFee);
    }

    emit PrizePoolAwarded(_msgSender(), prize, reserveFee);
    emit PrizePoolOpened(_msgSender(), prizePeriodStartedAt);

    return prize;
  }

  function awardTickets(address user, uint256 amount) external override onlyPrizeStrategy nonReentrant {
    require(prizeStrategyBalance >= amount, "PrizePool/insuff");
    prizeStrategyBalance = prizeStrategyBalance.sub(amount);
    // The tickets were already accruing, so just tack them onto the prize average
    prizeAverageTickets = prizeAverageTickets.add(amount);
    _mintTickets(user, amount);

    emit Awarded(_msgSender(), user, address(__ticket), amount);
  }

  function awardSponsorship(address user, uint256 amount) external override onlyPrizeStrategy nonReentrant {
    require(prizeStrategyBalance >= amount, "PrizePool/insuff");
    prizeStrategyBalance = prizeStrategyBalance.sub(amount);

    _mintSponsorship(user, amount);

    emit Awarded(_msgSender(), user, address(sponsorship), amount);
  }

  function prizePeriodEndAt() external view override returns (uint256) {
    // current prize started at is non-inclusive, so add one
    return _prizePeriodEndAt();
  }

  function _prizePeriodEndAt() internal view returns (uint256) {
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

  function _currentTime() internal virtual view returns (uint256) {
    return block.timestamp;
  }

  //
  // Ticket Minting/Redeeming
  //

  function mintTickets(address to, uint256 amount) external override nonReentrant {
    _token().transferFrom(_msgSender(), address(this), amount);
    _supply(amount);
    _mintTickets(to, amount);
    _mintedTickets(amount);
  }

  function _mintTickets(address to, uint256 amount) internal {
    // Mint tickets
    __ticket.controllerMint(to, amount);
    _mintTicketInterestShares(to, amount);
  }

  function _mintTicketInterestShares(address to, uint256 amount) internal {
    uint256 shares = supplyCollateral(amount);
    ticketInterestShares[to] = ticketInterestShares[to].add(shares);
  }

  function redeemTicketsInstantlyFrom(
    address from,
    uint256 tickets
  ) 
    external nonReentrant returns (uint256) 
  {
    address operator = _msgSender();

    uint256 userInterestRatioMantissa = _ticketInterestRatioMantissa(from);
    uint256 exitFee = calculateExitFee(tickets, userInterestRatioMantissa);

    // transfer the fee to this contract
    _token().transferFrom(operator, address(this), exitFee);

    // burn the tickets
    _burnTickets(operator, from, tickets);
    // burn the interestTracker
    _redeemTicketInterestShares(from, tickets, userInterestRatioMantissa);

    // redeem the tickets less the fee
    uint256 amount = tickets.sub(exitFee);
    _redeem(amount);
    _token().transfer(from, amount);

    emit TicketsRedeemedInstantly(operator, from, tickets, exitFee);

    // return the exit fee
    return exitFee;
  }

  function balanceOfTicketInterest(address user) public returns (uint256) {
    uint256 tickets = __ticket.balanceOf(user);
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
    uint256 tickets = __ticket.balanceOf(user);
    return FixedPoint.calculateMantissa(_balanceOfTicketInterest(user, tickets), tickets);
  }

  function redeemTicketsInstantly(uint256 tickets) external nonReentrant returns (uint256) {
    address sender = _msgSender();
    require(__ticket.balanceOf(sender) >= tickets, "Insufficient balance");
    uint256 userInterestRatioMantissa = _ticketInterestRatioMantissa(sender);

    uint256 exitFee = calculateExitFee(
      tickets,
      userInterestRatioMantissa
    );

    // burn the tickets
    _burnTickets(sender, sender, tickets);

    // now calculate how much interest needs to be redeemed to maintain the interest ratio
    _redeemTicketInterestShares(sender, tickets, userInterestRatioMantissa);

    uint256 ticketsLessFee = tickets.sub(exitFee);

    // redeem the interestTracker less the fee
    _redeem(ticketsLessFee);
    _token().transfer(sender, ticketsLessFee);

    emit TicketsRedeemedInstantly(sender, sender, tickets, exitFee);

    // return the exit fee
    return exitFee;
  }

  function _redeemTicketInterestShares(
    address sender,
    uint256 tickets,
    uint256 userInterestRatioMantissa
  )
    internal
  {
    uint256 ticketInterest = FixedPoint.multiplyUintByMantissa(tickets, userInterestRatioMantissa);
    uint256 burnedShares = redeemCollateral(tickets.add(ticketInterest));
    ticketInterestShares[sender] = ticketInterestShares[sender].sub(burnedShares);
    ticketCredit.controllerMint(sender, ticketInterest);
  }

  function redeemTicketsWithTimelockFrom(
    address from,
    uint256 tickets
  ) 
    external nonReentrant returns (uint256) 
  {
    address operator = _msgSender();
    return _redeemTicketsWithTimelock(operator, from, tickets);
  }

  function redeemTicketsWithTimelock(uint256 tickets) external nonReentrant returns (uint256) {
    address sender = _msgSender();
    return _redeemTicketsWithTimelock(sender, sender, tickets);
  }

  function _redeemTicketsWithTimelock(
    address operator,
    address sender,
    uint256 tickets
  ) 
    internal returns (uint256) 
  {
    // burn the tickets
    require(__ticket.balanceOf(sender) >= tickets, "PrizePool/insuff-tickets");
    _burnTickets(operator, sender, tickets);

    uint256 unlockTimestamp = calculateUnlockTimestamp(sender, tickets);

    // Sweep the old balance, if any
    address[] memory senders = new address[](1);
    senders[0] = sender;

    sweep(senders);

    mintTo(sender, tickets, unlockTimestamp);

    emit TicketsRedeemedWithTimelock(operator, sender, tickets, unlockTimestamp);

    // if the funds should already be unlocked
    if (unlockTimestamp <= block.timestamp) {
      sweep(senders);
    }

    // return the block at which the funds will be available
    return unlockTimestamp;
  }

  function _burnTickets(address operator, address from, uint256 tickets) internal {
    __ticket.controllerBurn(operator, from, tickets);
    _redeemedTickets(tickets);
  }

  //
  // Sponsorship Minting/Redeeming
  //

  function supplySponsorship(
    address receiver, 
    uint256 amount
  ) 
    public nonReentrant 
  {
    address sender = _msgSender();

    // Transfer Assets
    _token().transferFrom(sender, address(this), amount);
    _supply(amount);

    // Mint Tokens
    _mintSponsorship(receiver, amount);

    emit SponsorshipSupplied(sender, receiver, amount);
  }

  function redeemSponsorship(
    uint256 amount
  ) 
    public nonReentrant 
  {
    address sender = _msgSender();
    _redeemSponsorship(sender, sender, amount);
  }

  function redeemSponsorshipFrom(
    address from, 
    uint256 amount
  ) 
    public nonReentrant
  {
    _redeemSponsorship(_msgSender(), from, amount);
  }

  function _redeemSponsorship(
    address operator,
    address from,
    uint256 amount
  ) internal {
    require(sponsorshipInterestShares[from] >= amount, "PrizePool/insuff-sponsorship-shares");

    // Burn Tokens
    _burnSponsorship(operator, from, amount);

    // Transfer Assets
    _redeem(amount);
    _token().transfer(from, amount);

    emit SponsorshipRedeemed(operator, from, amount);
  }

  function _mintSponsorship(
    address account,
    uint256 amount
  ) internal {
    // Mint sponsorship tokens
    sponsorship.controllerMint(account, amount);

    // Supply collateral for interest tracking
    _mintSponsorshipInterestShares(account, amount);

    // Burn & accredit any accrued interest on sponsored collateral
    _sweepSponsorshipInterest(account);
  }

  function _mintSponsorshipInterestShares(
    address account,
    uint256 amount
  ) internal returns (uint256) {
    uint256 shares = supplyCollateral(amount);
    sponsorshipInterestShares[account] = sponsorshipInterestShares[account].add(shares);

    emit SponsorshipInterestMinted(_msgSender(), account, shares);
    return shares;
  }

  function _burnSponsorship(
    address operator,
    address account,
    uint256 amount
  ) internal {
    // Burn & accredit accrued interest on collateral
    _burnSponsorshipCollateralSweepInterest(account, amount);

    // Burn sponsorship tokens
    sponsorship.controllerBurn(operator, account, amount);
  }

  function _burnSponsorshipCollateralSweepInterest(
    address account, 
    uint256 collateralAmount
  ) internal {
    // Burn collateral + interest from interest tracker
    uint256 interest = _mintSponsorshipCredit(account);
    _burnSponsorshipFromInterestTracker(account, interest.add(collateralAmount));
  }

  function _calculateInterestOnSponsorship(address account) internal returns (uint256 interest) {
    // Calculate interest on collateral to be accreditted to account
    uint256 collateral = FixedPoint.divideUintByMantissa(sponsorshipInterestShares[account], _exchangeRateMantissa());
    interest = collateral.sub(sponsorship.balanceOf(account));
  }

  function _burnSponsorshipFromInterestTracker(address account, uint256 amount) internal {
    // Burn collateral/interest from interest tracker
    uint256 shares = redeemCollateral(amount);
    sponsorshipInterestShares[account] = sponsorshipInterestShares[account].sub(shares);

    emit SponsorshipInterestBurned(_msgSender(), account, shares);
  }

  function _mintSponsorshipCredit(
    address account
  ) 
    internal returns (uint256 interest) 
  {
    // Mint accrued interest on existing collateral
    interest = _calculateInterestOnSponsorship(account);
    sponsorshipCredit.controllerMint(account, interest);
  }

  //
  // Sponsorship Sweep
  //

  function sweepSponsorship(
    address[] memory accounts
  ) 
    public 
  {
    for (uint256 i = 0; i < accounts.length; i++) {
      address account = accounts[i];
      _sweepSponsorshipInterest(account);
    }
  }

  function _sweepSponsorshipInterest(
    address account
  ) 
    internal 
  {
    uint256 interest = _mintSponsorshipCredit(account);
    _burnSponsorshipFromInterestTracker(account, interest);
  }

  //
  // Public Read
  //

  function balanceOfInterestShares(address user) external view returns (uint256) {
    return ticketInterestShares[user];
  }

  function balanceOfSponsorshipInterestShares(address user) external view returns (uint256) {
    return sponsorshipInterestShares[user];
  }

  function _msgSender() internal override(BaseRelayRecipient, ContextUpgradeSafe) virtual view returns (address payable) {
    return BaseRelayRecipient._msgSender();
  }

  function beforeTokenTransfer(address from, address to, uint256 amount) external override {
    // handle transfers of tickets, sponsorship, credits etc

    address sender = _msgSender();

    // transfers of credits are ignored
    if (sender == address(__ticket)) {
      beforeTicketTransfer(from, to, amount);
    } else if (sender == address(sponsorship)) {
      beforeSponsorshipTransfer(from, to, amount);
    }
  }

  function beforeTicketTransfer(address from, address to, uint256 amount) internal {
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

  function beforeSponsorshipTransfer(address from, address to, uint256 amount) internal {
    // minting and burning are handled elsewhere
    if (from == address(0) || to == address(0)) {
      return;
    }

    // otherwise do the business here
    _burnSponsorshipCollateralSweepInterest(from, amount);
    _mintSponsorshipInterestShares(to, amount);
  }

  function balanceOfTicketInterestShares(address user) public view returns (uint256) {
    return ticketInterestShares[user];
  }

  modifier onlyPrizeStrategy() {
    require(_msgSender() == address(prizeStrategy), "PrizePool/only-prize-strategy");
    _;
  }
}
