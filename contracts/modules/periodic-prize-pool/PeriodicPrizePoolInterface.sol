pragma solidity ^0.6.4;

import "../yield-service/YieldServiceInterface.sol";
import "../ticket/Ticket.sol";
import "../sponsorship/Sponsorship.sol";
import "../../prize-strategy/PrizeStrategyInterface.sol";

interface PeriodicPrizePoolInterface {
  function estimatePrize() external returns (uint256);
  function estimatePrizeWithBlockTime(uint256 secondsPerBlockMantissa) external returns (uint256);
  function estimateRemainingPrize() external view returns (uint256);
  function estimateRemainingPrizeWithBlockTime(uint256 secondsPerBlockMantissa) external view returns (uint256);
  function prizePeriodSeconds() external view returns (uint256);
  function prizePeriodRemainingSeconds() external view returns (uint256);
  function prizePeriodStartedAt() external view returns (uint256);
  function prizePeriodEndAt() external view returns (uint256);
  function calculateExitFee(address sender, uint256 tickets) external view returns (uint256);
  function calculateUnlockTimestamp(address sender, uint256 tickets) external view returns (uint256);
  function yieldService() external view returns (YieldServiceInterface);
  function currentPrize() external returns (uint256);
  function sponsorship() external view returns (Sponsorship);
  function ticket() external view returns (Ticket);
  function prizeStrategy() external view returns (PrizeStrategyInterface);
  function canStartAward() external view returns (bool);
  function startAward() external;
  function canCompleteAward() external view returns (bool);
  function completeAward() external;
}