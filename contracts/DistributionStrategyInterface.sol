pragma solidity ^0.6.4;

interface DistributionStrategyInterface {
  function distribute(uint256 randomNumber, uint256 prize) external;
}