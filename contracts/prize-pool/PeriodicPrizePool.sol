pragma solidity ^0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@nomiclabs/buidler/console.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "../token/ControlledTokenFactory.sol";
import "../external/openzeppelin/ReentrancyGuard.sol";
import "../yield-service/YieldServiceInterface.sol";
import "../token/TokenControllerInterface.sol";
import "../token/Sponsorship.sol";
import "../token/Loyalty.sol";
import "./PrizePoolInterface.sol";
import "../prize-strategy/PrizeStrategyInterface.sol";
import "../rng/RNGInterface.sol";
import "../util/ERC1820Helper.sol";
import "../token/ControlledTokenFactory.sol";

/* solium-disable security/no-block-members */
contract PeriodicPrizePool is ReentrancyGuard, BaseRelayRecipient, PrizePoolInterface, ERC1820Helper {
  using SafeMath for uint256;

  event TicketsRedeemedInstantly(address indexed to, uint256 amount, uint256 fee);
  event TicketsRedeemedWithTimelock(address indexed to, uint256 amount, uint256 unlockTimestamp);

  YieldServiceInterface public override yieldService;
  Ticket public override ticket;
  Sponsorship public override sponsorship;
  PrizeStrategyInterface public override prizeStrategy;
  
  RNGInterface public rng;
  uint256 public currentPrizeStartedAt;
  uint256 prizePeriodSeconds;
  uint256 public previousPrize;
  uint256 public feeScaleMantissa;
  uint256 public rngRequestId;

  constructor() public ReentrancyGuard() {}

  function initialize (
    address _trustedForwarder,
    Sponsorship _sponsorship,
    Ticket _ticket,
    YieldServiceInterface _yieldService,
    PrizeStrategyInterface _prizeStrategy,
    RNGInterface _rng,
    uint256 _prizePeriodSeconds
  ) public initializer {
    ReentrancyGuard.initialize();
    require(address(_sponsorship) != address(0), "sponsorship must not be zero");
    require(address(_sponsorship.controller()) == address(this), "sponsorship controller does not match");
    require(address(_ticket) != address(0), "ticket is not zero");
    require(address(_ticket.prizePool()) == address(this), "ticket is not for this prize pool");
    require(address(_yieldService) != address(0), "yield service must not be zero");
    require(address(_prizeStrategy) != address(0), "prize strategy must not be zero");
    require(_prizePeriodSeconds > 0, "prize period must be greater than zero");
    require(address(_rng) != address(0), "rng cannot be zero");
    yieldService = _yieldService;
    ticket = _ticket;
    prizeStrategy = _prizeStrategy;
    sponsorship = _sponsorship;
    trustedForwarder = _trustedForwarder;
    rng = _rng;
    prizePeriodSeconds = _prizePeriodSeconds;
    currentPrizeStartedAt = block.timestamp;
  }

  function currentPrize() public override returns (uint256) {
    uint256 yieldBalance = yieldService.balanceOf(address(this));
    uint256 supply = sponsorship.totalSupply();
    uint256 prize;
    if (yieldBalance > supply) {
      prize = yieldBalance.sub(supply);
    }
    return prize;
  }

  function mintSponsorship(uint256 amount) external override nonReentrant {
    _mintSponsorship(_msgSender(), amount);
  }

  function mintSponsorshipTo(address to, uint256 amount) external override nonReentrant {
    _mintSponsorship(to, amount);
  }

  function _mintSponsorship(address to, uint256 amount) internal {
    // Transfer deposit
    IERC20 token = yieldService.token();
    require(token.allowance(_msgSender(), address(this)) >= amount, "insuff");
    token.transferFrom(_msgSender(), address(this), amount);

    // create the sponsorship
    sponsorship.mint(to, amount);

    // Deposit into pool
    token.approve(address(yieldService), amount);
    yieldService.supply(amount);
  }

  function redeemSponsorship(uint256 amount) external override nonReentrant {
    // burn the sponsorship
    sponsorship.burn(_msgSender(), amount);

    // redeem the collateral
    yieldService.redeem(amount);

    // transfer back to user
    IERC20(yieldService.token()).transfer(_msgSender(), amount);
  }

  function calculateRemainingPreviousPrize() public view override returns (uint256) {
    return multiplyByRemainingTimeFraction(previousPrize);
  }

  function multiplyByRemainingTimeFraction(uint256 value) public view returns (uint256) {
    return FixedPoint.multiplyUintByMantissa(
      value,
      FixedPoint.calculateMantissa(remainingSecondsToPrize(), prizePeriodSeconds)
    );
  }

  function calculateUnlockTimestamp(address, uint256) public view override returns (uint256) {
    return prizePeriodEndAt();
  }

  function estimatePrize(uint256 secondsPerBlockFixedPoint18) external returns (uint256) {
    return currentPrize().add(estimateRemainingPrizeWithBlockTime(secondsPerBlockFixedPoint18));
  }

  function estimateRemainingPrize() public view returns (uint256) {
    return estimateRemainingPrizeWithBlockTime(13 ether);
  }

  function estimateRemainingPrizeWithBlockTime(uint256 secondsPerBlockFixedPoint18) public view returns (uint256) {
    return yieldService.estimateAccruedInterestOverBlocks(
      sponsorship.totalSupply(),
      estimateRemainingBlocksToPrize(secondsPerBlockFixedPoint18)
    );
  }

  function estimateRemainingBlocksToPrize(uint256 secondsPerBlockFixedPoint18) public view returns (uint256) {
    return FixedPoint.divideUintByMantissa(
      remainingSecondsToPrize(),
      secondsPerBlockFixedPoint18
    );
  }

  function remainingSecondsToPrize() public view returns (uint256) {
    uint256 endAt = prizePeriodEndAt();
    if (block.timestamp > endAt) {
      return 0;
    } else {
      return endAt - block.timestamp;
    }
  }

  function isPrizePeriodOver() public view returns (bool) {
    return block.timestamp > prizePeriodEndAt();
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

  function startAward() external override requireCanStartAward nonReentrant {
    rngRequestId = rng.requestRandomNumber(address(0),0);
  }

  function completeAward() external override requireCanCompleteAward nonReentrant {
    uint256 prize = currentPrize();
    if (prize > 0) {
      sponsorship.mint(address(this), prize);
      sponsorship.approve(address(prizeStrategy), prize);
    }
    currentPrizeStartedAt = block.timestamp;
    prizeStrategy.award(uint256(rng.randomNumber(rngRequestId)), prize);
    previousPrize = prize;
    rngRequestId = 0;
  }

  function token() external override view returns (IERC20) {
    return yieldService.token();
  }

  function prizePeriodEndAt() public view returns (uint256) {
    // current prize started at is non-inclusive, so add one
    return currentPrizeStartedAt + prizePeriodSeconds;
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
}
