pragma solidity ^0.6.4;

import "./PrizePoolInterface.sol";

interface PrizeStrategyInterface {
  function calculateExitFee(address user, uint256 tickets) external view returns (uint256);
  function calculateUnlockTimestamp(address user, uint256 tickets) external view returns (uint256);
  function prizePool() external view returns (PrizePoolInterface);
  function canAward() external view returns (bool);
  function startAward() external;
  function completeAward() external;
}