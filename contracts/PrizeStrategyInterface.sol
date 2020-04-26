pragma solidity ^0.6.4;

interface PrizeStrategyInterface {
  function calculateExitFee(address user, uint256 tickets) external view returns (uint256);
  function calculateUnlockTimestamp(address user, uint256 tickets) external view returns (uint256);
}