pragma solidity ^0.6.4;

import "../DistributionStrategyInterface.sol";
import "../PrizePoolInterface.sol";

contract MockPrizeStrategy is DistributionStrategyInterface {
  bool public awardStarted;
  uint256 public prize;

  function startAward() external override {
    awardStarted = true;
  }

  function completeAward(uint256 _prize) external override {
    prize = _prize;
  }
}