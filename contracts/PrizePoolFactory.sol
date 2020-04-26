pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./InterestTokenInterface.sol";
import "./ControlledTokenFactory.sol";
import "./PrizeStrategyFactory.sol";
import "./InterestPoolFactory.sol";
import "./TicketFactory.sol";
import "./TicketPoolFactory.sol";
import "./PrizeStrategyInterface.sol";
import "./compound/CTokenInterface.sol";

contract PrizePoolFactory is Initializable {

  event PrizePoolCreated(
    address indexed interestPool,
    address indexed ticketPool,
    address indexed prizeStrategy,
    address interestPoolToken,
    address ticketPoolToken
  );

  InterestPoolFactory public interestPoolFactory;
  TicketPoolFactory public ticketPoolFactory;
  TicketFactory public ticketFactory;
  ControlledTokenFactory public controlledTokenFactory;
  PrizeStrategyFactory public prizeStrategyFactory;
  InterestTokenInterface public interestToken;

  function initialize (
    InterestPoolFactory _interestPoolFactory,
    TicketPoolFactory _ticketPoolFactory,
    TicketFactory _ticketFactory,
    ControlledTokenFactory _controlledTokenFactory,
    PrizeStrategyFactory _prizeStrategyFactory,
    InterestTokenInterface _interestToken
  ) public initializer {
    interestPoolFactory = _interestPoolFactory;
    ticketPoolFactory = _ticketPoolFactory;
    ticketFactory = _ticketFactory;
    controlledTokenFactory = _controlledTokenFactory;
    prizeStrategyFactory = _prizeStrategyFactory;
    interestToken = _interestToken;
  }

  function createSingleRandomWinnerTicketPool(
    CTokenInterface cToken,
    string calldata _collateralName,
    string calldata _collateralSymbol,
    string calldata _ticketName,
    string calldata _ticketSymbol,
    uint256 prizePeriodInBlocks
  ) external returns (TicketPool) {

    SingleRandomWinnerPrizeStrategy prizeStrategy = prizeStrategyFactory.createSingleRandomWinner();
    TicketPool ticketPool = createTicketPool(cToken, prizeStrategy, _collateralName, _collateralSymbol, _ticketName, _ticketSymbol);

    prizeStrategy.initialize(
      ticketPool,
      prizePeriodInBlocks
    );

    return ticketPool;
  }

  function createTicketPool(
    CTokenInterface cToken,
    PrizeStrategyInterface _prizeStrategy,
    string memory _collateralName,
    string memory _collateralSymbol,
    string memory _ticketName,
    string memory _ticketSymbol
  ) public returns (TicketPool) {

    InterestPool interestPool = interestPoolFactory.createInterestPool();
    TicketPool ticketPool = ticketPoolFactory.createTicketPool();
    Ticket ticket = ticketFactory.createTicket();
    ControlledToken collateral = controlledTokenFactory.createControlledToken(_collateralName, _collateralSymbol, interestPool);

    interestPool.initialize(
      cToken,
      collateral,
      address(ticketPool)
    );

    ticket.initialize(
      _ticketName,
      _ticketSymbol,
      ticketPool
    );

    ticketPool.initialize(
      ticket,
      interestPool,
      _prizeStrategy
    );

    emit PrizePoolCreated(
      address(interestPool),
      address(ticketPool),
      address(_prizeStrategy),
      address(collateral),
      address(ticket)
    );

    return ticketPool;
  }
}
