pragma solidity ^0.6.4;

import "../yield-service/YieldServiceInterface.sol";
import "../token/Ticket.sol";
import "../token/Sponsorship.sol";
import "../token/ControlledToken.sol";
import "../prize-strategy/PrizeStrategyInterface.sol";

interface PrizePoolInterface {
  function mintSponsorship(uint256 tickets) external;
  function mintSponsorshipTo(address to, uint256 tickets) external;
  function redeemSponsorship(uint256 tickets) external;
  function calculateUnlockTimestamp(address sender, uint256 tickets) external view returns (uint256);
  function calculateRemainingPreviousPrize() external view returns (uint256);
  function yieldService() external view returns (YieldServiceInterface);
  function currentPrize() external returns (uint256);
  function sponsorship() external view returns (Sponsorship);
  function token() external view returns (IERC20);
  function ticket() external view returns (Ticket);
  function prizeStrategy() external view returns (PrizeStrategyInterface);
  function canStartAward() external view returns (bool);
  function startAward() external;
  function canCompleteAward() external view returns (bool);
  function completeAward() external;
}
