pragma solidity ^0.6.4;

import "./TicketPool.sol";
import "./InterestPoolInterface.sol";
import "./ControlledToken.sol";
import "./compound/ICToken.sol";

contract TicketPoolFactory is Initializable {

  event TicketPoolCreated(address indexed ticketPool);

  function createTicketPool(
    Ticket _ticketToken,
    InterestPoolInterface _interestPool,
    PrizeStrategyInterface _prizeStrategy
  ) external returns (TicketPool) {
    TicketPool ticketPool = new TicketPool();
    ticketPool.initialize(_ticketToken, _interestPool, _prizeStrategy);
    emit TicketPoolCreated(address(ticketPool));
    return ticketPool;
  }
}