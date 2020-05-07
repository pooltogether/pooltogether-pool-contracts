pragma solidity ^0.6.4;

interface PrizeStrategyInterface {
  function award(uint256 randomNumber, uint256 prize) external;
}