pragma solidity ^0.6.4;

import "../DistributionStrategyInterface.sol";
import "../PrizePoolInterface.sol";

contract MockPrizeStrategy is DistributionStrategyInterface {
  uint256 public randomNumber;
  uint256 public prize;

  function distribute(uint256 _randomNumber, uint256 _prize) external override {
    prize = _prize;
    randomNumber = _randomNumber;
  }
}