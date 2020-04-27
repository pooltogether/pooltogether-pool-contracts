pragma solidity ^0.6.4;

import "./Ticket.sol";
import "./ProxyFactory.sol";

contract TicketFactory is ProxyFactory {

  event TicketCreated(address indexed ticket);

  Ticket public instance;

  constructor () public {
    instance = new Ticket();
  }

  function createTicket() external returns (Ticket) {
    Ticket ticket = Ticket(deployMinimal(address(instance), ""));
    emit TicketCreated(address(ticket));
    return ticket;
  }
}