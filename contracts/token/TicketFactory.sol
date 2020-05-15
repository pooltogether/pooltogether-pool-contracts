pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./Ticket.sol";
import "./ControlledTokenFactory.sol";
import "../external/openzeppelin/ProxyFactory.sol";

contract TicketFactory is Initializable, ProxyFactory {

  event TicketCreated(address indexed ticket);

  Ticket public instance;
  ControlledTokenFactory public controlledTokenFactory;

  function initialize (
    ControlledTokenFactory _controlledTokenFactory
  ) public initializer {
    require(address(_controlledTokenFactory) != address(0), "controlledTokenFactory cannot be zero");
    controlledTokenFactory = _controlledTokenFactory;
    instance = new Ticket();
  }

  function createTicket() public returns (Ticket) {
    Ticket ticket = Ticket(deployMinimal(address(instance), ""));
    emit TicketCreated(address(ticket));
    return ticket;
  }

  function createTicket(
    string memory _name,
    string memory _symbol,
    PrizePoolInterface _prizePool,
    address _trustedForwarder
  ) public returns (Ticket) {
    Ticket token = createTicket();
    ControlledToken timelock = controlledTokenFactory.createControlledToken("", "", address(token), _trustedForwarder);
    token.initialize(
      _name,
      _symbol,
      _prizePool,
      timelock,
      _trustedForwarder
    );
    return token;
  }
}