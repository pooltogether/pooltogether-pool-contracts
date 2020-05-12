pragma solidity ^0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "./PrizePool.sol";
import "../token/ControlledTokenFactory.sol";

/* solium-disable security/no-block-members */
contract PeriodicPrizePool is PrizePool {
  using SafeMath for uint256;

  RNGInterface public rng;
  uint256 public currentPrizeStartedAt;
  uint256 prizePeriodSeconds;
  uint256 public previousPrize;
  uint256 public feeScaleMantissa;
  uint256 public rngRequestId;

  function initialize (
    Ticket _ticket,
    ControlledToken _sponsorship,
    ControlledTokenFactory controlledTokenFactory,
    YieldServiceInterface _yieldService,
    PrizeStrategyInterface _prizeStrategy,
    address _trustedForwarder,
    RNGInterface _rng,
    uint256 _prizePeriodSeconds
  ) public initializer {
    super.initialize(_ticket, _sponsorship, controlledTokenFactory, _yieldService, _prizeStrategy, _trustedForwarder);
    require(_prizePeriodSeconds > 0, "prize period must be greater than zero");
    require(address(_rng) != address(0), "rng cannot be zero");
    rng = _rng;
    prizePeriodSeconds = _prizePeriodSeconds;
    currentPrizeStartedAt = block.timestamp;
  }

  function calculateExitFee(address, uint256 tickets) public view override returns (uint256) {
    uint256 totalSupply = ticket.totalSupply();
    if (totalSupply == 0) {
      return 0;
    }
    return FixedPoint.multiplyUintByMantissa(
      multiplyByRemainingTimeFraction(previousPrize),
      FixedPoint.calculateMantissa(tickets, totalSupply)
    );
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
      ticket.totalSupply(),
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
