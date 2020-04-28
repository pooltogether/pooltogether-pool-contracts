pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
// import "@nomiclabs/buidler/console.sol";

import "./PrizePool.sol";
import "./PrizeStrategyInterface.sol";

/* solium-disable security/no-block-members */
contract SingleRandomWinnerPrizeStrategy is Initializable, PrizeStrategyInterface {
  using SafeMath for uint256;

  PrizePoolInterface public override prizePool;
  uint256 currentPrizeStartedAt;
  uint256 prizePeriodSeconds;
  uint256 previousPrize;

  function initialize (
    PrizePool _prizePool,
    uint256 _prizePeriodSeconds
  ) public initializer {
    require(address(_prizePool) != address(0), "prize pool must not be zero");
    require(_prizePeriodSeconds > 0, "prize period must be greater than zero");
    prizePool = _prizePool;
    prizePeriodSeconds = _prizePeriodSeconds;
    currentPrizeStartedAt = block.timestamp;
  }

  function calculateExitFee(address, uint256 tickets) public view override returns (uint256) {
    uint256 totalSupply = prizePool.ticket().totalSupply();
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
    return prizePool.currentPrize().add(estimateRemainingPrizeWithBlockTime(secondsPerBlockFixedPoint18));
  }

  function estimateRemainingPrize() public view returns (uint256) {
    return estimateRemainingPrizeWithBlockTime(13 ether);
  }

  function estimateRemainingPrizeWithBlockTime(uint256 secondsPerBlockFixedPoint18) public view returns (uint256) {
    InterestPoolInterface interestPool = prizePool.interestPool();
    return interestPool.estimateAccruedInterestOverBlocks(
      interestPool.accountedBalance(),
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

  function canAward() public view returns (bool) {
    return block.timestamp > prizePeriodEndAt();
  }

  function award() external onlyPrizePeriodOver {
    address winner = ticket().draw(uint256(blockhash(1)));
    uint256 total = prizePool.currentPrize();
    previousPrize = total;
    prizePool.award(winner, total);
    currentPrizeStartedAt = block.timestamp;
  }

  function prizePeriodEndAt() public view returns (uint256) {
    // current prize started at is non-inclusive, so add one
    return currentPrizeStartedAt + prizePeriodSeconds;
  }

  function ticket() public view returns (Ticket) {
    return prizePool.ticket();
  }

  modifier onlyPrizePeriodOver() {
    require(canAward(), "prize period not over");
    _;
  }
}
