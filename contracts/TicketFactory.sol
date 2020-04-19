pragma solidity ^0.6.4;

import "./Ticket.sol";

contract TicketFactory is Initializable {

  event TicketCreated(address indexed ticket);

  function createTicket(
    string calldata _name,
    string calldata _symbol,
    TokenControllerInterface _controller
  ) external returns (Ticket) {
    Ticket ticket = new Ticket();
    ticket.initialize(
      _name,
      _symbol,
      _controller
    );
    emit TicketCreated(address(ticket));
    return ticket;
  }
}