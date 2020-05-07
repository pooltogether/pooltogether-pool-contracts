pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "./PrizePool.sol";

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
    ControlledToken _timelock,
    YieldServiceInterface _yieldService,
    PrizeStrategyInterface _prizeStrategy,
    RNGInterface _rng,
    uint256 _prizePeriodSeconds
  ) public initializer {
    super.initialize(_ticket, _sponsorship, _timelock, _yieldService, _prizeStrategy);
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

  function estimatePrize(uint256 secondsPerBlockFixedPoint18) external view returns (uint256) {
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

  function canAward() public view override returns (bool) {
    return block.timestamp > prizePeriodEndAt();
  }

  function startAward() external override onlyPrizePeriodOver {
    rngRequestId = rng.requestRandomNumber(address(0),0);
  }

  function completeAward() external override {
    uint256 prize = currentPrize();
    sponsorship.mint(address(this), prize);
    sponsorship.approve(address(prizeStrategy), prize);
    currentPrizeStartedAt = block.timestamp;
    prizeStrategy.award(uint256(rng.randomNumber(rngRequestId)), prize);
    previousPrize = prize;
  }

  function prizePeriodEndAt() public view returns (uint256) {
    // current prize started at is non-inclusive, so add one
    return currentPrizeStartedAt + prizePeriodSeconds;
  }

  modifier onlyPrizePeriodOver() {
    require(canAward(), "prize period not over");
    _;
  }

  modifier onlyRngRequestComplete() {
    require(rng.isRequestComplete(rngRequestId), "rng request has not completed");
    _;
  }

  modifier notRequestingRN(address sender) {
    require(rngRequestId == 0, "rng request is in flight");
    _;
  }
}
