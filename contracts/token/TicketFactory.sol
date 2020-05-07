pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./Ticket.sol";
import "../external/openzeppelin/ProxyFactory.sol";

contract TicketFactory is Initializable, ProxyFactory {

  event TicketCreated(address indexed ticket);

  Ticket public instance;

  function initialize () public initializer {
    instance = new Ticket();
  }

  function createTicket() public returns (Ticket) {
    Ticket ticket = Ticket(deployMinimal(address(instance), ""));
    emit TicketCreated(address(ticket));
    return ticket;
  }

  function createTicket(
    string memory _interestName,
    string memory _interestSymbol,
    TokenControllerInterface controller
  ) public returns (Ticket) {
    Ticket token = createTicket();
    token.initialize(
      _interestName,
      _interestSymbol,
      controller
    );
    return token;
  }
}