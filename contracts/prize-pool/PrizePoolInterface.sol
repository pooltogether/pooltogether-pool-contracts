pragma solidity ^0.6.4;

import "../yield-service/YieldServiceInterface.sol";
import "../token/Ticket.sol";
import "../token/ControlledToken.sol";
import "../prize-strategy/PrizeStrategyInterface.sol";

interface PrizePoolInterface {
  function mintTickets(uint256 tickets) external;
  function mintTicketsTo(address to, uint256 tickets) external;
  function mintTicketsWithSponsorship(uint256 tickets) external;
  function mintTicketsWithSponsorshipTo(address to, uint256 tickets) external;
  function mintTicketsWithTimelock(uint256 tickets) external;
  function mintSponsorship(uint256 tickets) external;
  function mintSponsorshipTo(address to, uint256 tickets) external;
  function redeemSponsorship(uint256 tickets) external;
  function redeemTicketsInstantly(uint256 tickets) external returns (uint256);
  function redeemTicketsWithTimelock(uint256 tickets) external returns (uint256);
  function lockedBalanceOf(address user) external view returns (uint256);
  function lockedBalanceAvailableAt(address user) external view returns (uint256);
  function sweepTimelockFunds(address[] calldata users) external returns (uint256);
  function calculateExitFee(address sender, uint256 tickets) external view returns (uint256);
  function calculateUnlockTimestamp(address sender, uint256 tickets) external view returns (uint256);
  function yieldService() external view returns (YieldServiceInterface);
  function currentPrize() external view returns (uint256);
  function sponsorship() external view returns (ControlledToken);
  function timelock() external view returns (ControlledToken);
  function ticket() external view returns (Ticket);
  function prizeStrategy() external view returns (PrizeStrategyInterface);
  function canAward() external view returns (bool);
  function startAward() external;
  function completeAward() external;
}
