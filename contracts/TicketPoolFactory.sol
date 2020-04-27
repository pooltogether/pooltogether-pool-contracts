pragma solidity ^0.6.4;

import "./TicketPool.sol";
import "./InterestPoolInterface.sol";
import "./ControlledToken.sol";
import "./ProxyFactory.sol";

contract TicketPoolFactory is ProxyFactory {

  event TicketPoolCreated(address indexed ticketPool);

  TicketPool public instance;

  constructor () public {
    instance = new TicketPool();
  }

  function createTicketPool() external returns (TicketPool) {
    TicketPool ticketPool = TicketPool(deployMinimal(address(instance), ""));
    emit TicketPoolCreated(address(ticketPool));
    return ticketPool;
  }
}