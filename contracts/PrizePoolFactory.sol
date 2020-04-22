pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./compound/ICToken.sol";
import "./ControlledTokenFactory.sol";
import "./PrizeStrategyFactory.sol";
import "./InterestPoolFactory.sol";
import "./TicketFactory.sol";
import "./TicketPoolFactory.sol";
import "./PrizeStrategyInterface.sol";

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
  ICToken public cToken;

  function initialize (
    InterestPoolFactory _interestPoolFactory,
    TicketPoolFactory _ticketPoolFactory,
    TicketFactory _ticketFactory,
    ControlledTokenFactory _controlledTokenFactory,
    PrizeStrategyFactory _prizeStrategyFactory,
    ICToken _cToken
  ) public initializer {
    interestPoolFactory = _interestPoolFactory;
    ticketPoolFactory = _ticketPoolFactory;
    ticketFactory = _ticketFactory;
    controlledTokenFactory = _controlledTokenFactory;
    prizeStrategyFactory = _prizeStrategyFactory;
    cToken = _cToken;
  }

  function createSingleRandomWinnerTicketPool(
    string calldata _interestName,
    string calldata _interestSymbol,
    string calldata _ticketName,
    string calldata _ticketSymbol,
    uint256 prizePeriodInBlocks
  ) external returns (TicketPool) {

    SingleRandomWinnerPrizeStrategy prizeStrategy = prizeStrategyFactory.createSingleRandomWinner();
    TicketPool ticketPool = createTicketPool(prizeStrategy, _interestName, _interestSymbol, _ticketName, _ticketSymbol);

    prizeStrategy.initialize(
      ticketPool,
      prizePeriodInBlocks
    );

    emit PrizePoolCreated(
      address(ticketPool.interestPool()),
      address(ticketPool),
      address(prizeStrategy),
      address(ticketPool.interestPool().collateralToken()),
      address(ticketPool.ticketToken())
    );

    return ticketPool;
  }

  function createTicketPool(
    PrizeStrategyInterface _prizeStrategy,
    string memory _interestName,
    string memory _interestSymbol,
    string memory _ticketName,
    string memory _ticketSymbol
  ) public returns (TicketPool) {

    InterestPool interestPool = interestPoolFactory.createInterestPool();
    TicketPool ticketPool = ticketPoolFactory.createTicketPool();
    Ticket ticket = ticketFactory.createTicket();
    ControlledToken collateral = controlledTokenFactory.createControlledToken(_interestName, _interestSymbol, interestPool);

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

    return ticketPool;
  }
}
