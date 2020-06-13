pragma solidity ^0.6.4;

import "../prize-strategy/PrizeStrategyInterface.sol";

interface PeriodicPrizePoolInterface {
  function estimatePrize() external returns (uint256);
  function estimatePrizeWithBlockTime(uint256 secondsPerBlockMantissa) external returns (uint256);
  function estimateRemainingPrize() external view returns (uint256);
  function estimateRemainingPrizeWithBlockTime(uint256 secondsPerBlockMantissa) external view returns (uint256);
  function prizePeriodSeconds() external view returns (uint256);
  function prizePeriodRemainingSeconds() external view returns (uint256);
  function prizePeriodStartedAt() external view returns (uint256);
  function prizePeriodEndAt() external view returns (uint256);
  function calculateExitFee(uint256 tickets, uint256 ticketInterestRatioMantissa) external view returns (uint256);
  function calculateUnlockTimestamp(address sender, uint256 tickets) external view returns (uint256);
  function currentPrize() external returns (uint256);
  function prizeStrategy() external view returns (PrizeStrategyInterface);
  function canStartAward() external view returns (bool);
  function startAward() external;
  function canCompleteAward() external view returns (bool);
  function completeAward() external;
  function mintedTickets(uint256 amount) external;
  function redeemedTickets(uint256 amount) external;
}