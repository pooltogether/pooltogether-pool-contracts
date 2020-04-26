pragma solidity ^0.6.4;

import "./InterestPoolInterface.sol";
import "./Ticket.sol";

interface TicketPoolInterface {
  function interestPool() external view returns (InterestPoolInterface);
  function currentPrize() external view returns (uint256);
  function award(address user, uint256 tickets) external;
  function ticket() external view returns (Ticket);
}