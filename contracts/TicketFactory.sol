pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./Ticket.sol";
import "./ProxyFactory.sol";

contract TicketFactory is Initializable, ProxyFactory {

  event TicketCreated(address indexed ticket);

  Ticket public instance;

  function initialize () public initializer {
    instance = new Ticket();
  }

  function createTicket() external returns (Ticket) {
    Ticket ticket = Ticket(deployMinimal(address(instance), ""));
    emit TicketCreated(address(ticket));
    return ticket;
  }
}