pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./Ticket.sol";
import "../../external/openzeppelin/ProxyFactory.sol";

contract TicketFactory is Initializable, ProxyFactory {

  Ticket public instance;

  function initialize () public initializer {
    instance = new Ticket();
  }

  function createTicket() public returns (Ticket) {
    return Ticket(deployMinimal(address(instance), ""));
  }
}