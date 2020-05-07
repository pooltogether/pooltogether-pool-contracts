pragma solidity ^0.6.4;

import "../prize-strategy/PrizeStrategyInterface.sol";
import "../prize-pool/PrizePoolInterface.sol";

contract MockPrizeStrategy is PrizeStrategyInterface {
  uint256 public randomNumber;
  uint256 public prize;

  function award(uint256 _randomNumber, uint256 _prize) external override {
    prize = _prize;
    randomNumber = _randomNumber;
  }
}