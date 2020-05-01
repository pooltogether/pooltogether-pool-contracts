pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "./RNGInterface.sol";
import "./PeriodicPrizeStrategy.sol";

/* solium-disable security/no-block-members */
contract SingleRandomWinnerPrizeStrategy is PeriodicPrizeStrategy {
  using SafeMath for uint256;

  RNGInterface public rng;

  uint256 rngRequestId;

  function initialize(
    PrizePool _prizePool,
    uint256 _prizePeriodSeconds,
    RNGInterface _rng
  ) public initializer {
    require(address(_rng) != address(0), "rng cannot be zero");
    super.initialize(_prizePool, _prizePeriodSeconds);
    rng = _rng;
  }

  function startAward() external override onlyPrizePeriodOver notRequestingRN {
    rngRequestId = rng.requestRandomNumber(address(0),0);
  }

  function completeAward() external override onlyRngRequestComplete {
    require(rng.isRequestComplete(rngRequestId), "rng request not complete");
    address winner = ticket().draw(uint256(rng.randomNumber(rngRequestId)));
    uint256 total = prizePool.currentPrize();
    previousPrize = total;
    rngRequestId = 0;
    prizePool.award(winner, total);
    currentPrizeStartedAt = block.timestamp;
  }

  modifier onlyRngRequestComplete() {
    require(rng.isRequestComplete(rngRequestId), "rng request has not completed");
    _;
  }

  modifier notRequestingRN() {
    require(rngRequestId == 0, "rng is being requested");
    _;
  }
}
