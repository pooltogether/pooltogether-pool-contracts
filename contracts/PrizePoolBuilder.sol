pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./ControlledTokenFactory.sol";
import "./SingleRandomWinnerPrizeStrategyFactory.sol";
import "./InterestPoolFactory.sol";
import "./TicketFactory.sol";
import "./PrizePoolFactory.sol";
import "./PrizeStrategyInterface.sol";
import "./compound/CTokenInterface.sol";

contract PrizePoolBuilder is Initializable {

  event PrizePoolCreated(
    address indexed interestPool,
    address indexed prizePool,
    address indexed prizeStrategy,
    address collateral,
    address ticket
  );

  InterestPoolFactory public interestPoolFactory;
  PrizePoolFactory public prizePoolFactory;
  TicketFactory public ticketFactory;
  ControlledTokenFactory public controlledTokenFactory;

  function initialize (
    InterestPoolFactory _interestPoolFactory,
    PrizePoolFactory _prizePoolFactory,
    TicketFactory _ticketFactory,
    ControlledTokenFactory _controlledTokenFactory
  ) public initializer {
    interestPoolFactory = _interestPoolFactory;
    prizePoolFactory = _prizePoolFactory;
    ticketFactory = _ticketFactory;
    controlledTokenFactory = _controlledTokenFactory;
  }

  function createPrizePool(
    CTokenInterface cToken,
    PrizeStrategyInterface _prizeStrategy,
    string memory _collateralName,
    string memory _collateralSymbol,
    string memory _ticketName,
    string memory _ticketSymbol
  ) public returns (PrizePool) {

    InterestPool interestPool = interestPoolFactory.createInterestPool();
    PrizePool prizePool = prizePoolFactory.createPrizePool();
    Ticket ticket = ticketFactory.createTicket();
    ControlledToken collateral = controlledTokenFactory.createControlledToken(_collateralName, _collateralSymbol, interestPool);

    interestPool.initialize(
      cToken,
      collateral,
      address(prizePool)
    );

    ticket.initialize(
      _ticketName,
      _ticketSymbol,
      prizePool
    );

    prizePool.initialize(
      ticket,
      interestPool,
      _prizeStrategy
    );

    emit PrizePoolCreated(
      address(interestPool),
      address(prizePool),
      address(_prizeStrategy),
      address(collateral),
      address(ticket)
    );

    return prizePool;
  }
}
