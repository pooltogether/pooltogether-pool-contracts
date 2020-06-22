pragma solidity ^0.6.4;

import "../ticket/TicketInterface.sol";
import "./YieldServiceInterface.sol";

interface PeriodicPrizePoolInterface is YieldServiceInterface {
  function estimatePrize() external returns (uint256);
  function estimatePrizeWithBlockTime(uint256 secondsPerBlockMantissa) external returns (uint256);
  function estimateRemainingPrize() external view returns (uint256);
  function estimateRemainingPrizeWithBlockTime(uint256 secondsPerBlockMantissa) external view returns (uint256);
  function prizePeriodSeconds() external view returns (uint256);
  function prizePeriodRemainingSeconds() external view returns (uint256);
  function prizePeriodStartedAt() external view returns (uint256);
  function prizePeriodEndAt() external view returns (uint256);
  function mintTickets(address to, uint256 amount, bytes calldata data) external;
  function ticket() external view returns (TicketInterface);
  function isPrizePeriodOver() external view returns (bool);
  function calculateExitFee(uint256 tickets, uint256 ticketInterestRatioMantissa) external view returns (uint256);
  function calculateUnlockTimestamp(address sender, uint256 tickets) external view returns (uint256);
  function currentPrize() external returns (uint256);
  function prizeStrategy() external view returns (address);
  function awardPrize() external returns (uint256);
  function awardTickets(address user, uint256 amount, bytes calldata data) external;
  function awardSponsorship(address user, uint256 amount, bytes calldata data) external;
}