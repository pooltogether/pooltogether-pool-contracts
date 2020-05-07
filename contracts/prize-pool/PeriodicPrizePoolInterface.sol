pragma solidity ^0.6.4;

interface PeriodicPrizePoolInterface {
  function estimatePrizeWithBlockTime(uint256 secondsPerBlockMantissa) external view returns (uint256);
  function estimatePrize() external view returns (uint256);
  function estimateRemainingPrize() external view returns (uint256);
  function estimateRemainingPrizeWithBlockTime(uint256 secondsPerBlockMantissa) external view returns (uint256);
  function remainingSecondsToPrize() external view returns (uint256);
  function prizePeriodEndAt() external view returns (uint256);
  function currentPrizeStartedAt() external view returns (uint256);
}