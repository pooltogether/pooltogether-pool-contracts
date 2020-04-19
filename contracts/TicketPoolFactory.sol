pragma solidity ^0.6.4;

import "./TicketPool.sol";
import "./InterestPoolInterface.sol";
import "./ControlledToken.sol";
import "./compound/ICToken.sol";

contract TicketPoolFactory {
  function createTicketPool(
    Ticket _ticketToken,
    InterestPoolInterface _interestPool,
    PrizeStrategyInterface _prizeStrategy
  ) external returns (TicketPool) {
    TicketPool ip = new TicketPool();
    ip.initialize(_ticketToken, _interestPool, _prizeStrategy);
    return ip;
  }
}