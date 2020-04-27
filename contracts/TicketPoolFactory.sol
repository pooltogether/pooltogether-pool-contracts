pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./TicketPool.sol";
import "./InterestPoolInterface.sol";
import "./ControlledToken.sol";
import "./ProxyFactory.sol";

contract TicketPoolFactory is Initializable, ProxyFactory {

  event TicketPoolCreated(address indexed ticketPool);

  TicketPool public instance;

  function initialize () public initializer {
    instance = new TicketPool();
  }

  function createTicketPool() external returns (TicketPool) {
    TicketPool ticketPool = TicketPool(deployMinimal(address(instance), ""));
    emit TicketPoolCreated(address(ticketPool));
    return ticketPool;
  }
}