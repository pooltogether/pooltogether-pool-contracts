pragma solidity ^0.6.4;

import "./Ticket.sol";

contract TicketFactory is Initializable {

  event TicketCreated(address indexed ticket);

  function createTicket() external returns (Ticket) {
    Ticket ticket = new Ticket();
    emit TicketCreated(address(ticket));
    return ticket;
  }
}