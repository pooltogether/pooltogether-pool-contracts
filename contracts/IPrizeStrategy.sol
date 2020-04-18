pragma solidity ^0.6.4;

interface IPrizeStrategy {
  function calculateExitFee(address user, uint256 tickets) external view returns (uint256);
  function calculateUnlockBlock(address user, uint256 tickets) external view returns (uint256);
}