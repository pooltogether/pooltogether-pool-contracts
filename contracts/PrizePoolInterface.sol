pragma solidity ^0.6.4;

import "./InterestPoolInterface.sol";
import "./Ticket.sol";

interface PrizePoolInterface {
  function mintTickets(uint256 tickets) external;
  function redeemTicketsInstantly(uint256 tickets) external returns (uint256);
  function redeemTicketsWithTimelock(uint256 tickets) external returns (uint256);
  function lockedBalanceOf(address user) external view returns (uint256);
  function lockedBalanceAvailableAt(address user) external view returns (uint256);
  function sweepTimelockFunds(address[] calldata users) external returns (uint256);
  function interestPool() external view returns (InterestPoolInterface);
  function currentPrize() external view returns (uint256);
  function award(address user, uint256 tickets) external;
  function ticket() external view returns (Ticket);
}