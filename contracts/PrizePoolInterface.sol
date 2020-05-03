pragma solidity ^0.6.4;

import "./InterestPoolInterface.sol";
import "./Ticket.sol";

interface PrizePoolInterface {
  function mintTickets(uint256 tickets) external;
  function mintTicketsTo(address to, uint256 tickets) external;
  function mintTicketsWithPrincipal(uint256 tickets) external;
  function mintTicketsWithPrincipalTo(address to, uint256 tickets) external;
  function redeemTicketsInstantly(uint256 tickets) external returns (uint256);
  function redeemTicketsWithTimelock(uint256 tickets) external returns (uint256);
  function lockedBalanceOf(address user) external view returns (uint256);
  function lockedBalanceAvailableAt(address user) external view returns (uint256);
  function sweepTimelockFunds(address[] calldata users) external returns (uint256);
  function calculateExitFee(address sender, uint256 tickets) external view returns (uint256);
  function calculateUnlockTimestamp(address sender, uint256 tickets) external view returns (uint256);
  function interestPool() external view returns (InterestPoolInterface);
  function currentPrize() external view returns (uint256);
  function ticket() external view returns (Ticket);
  function canAward() external view returns (bool);
  function startAward() external;
  function completeAward() external;
}