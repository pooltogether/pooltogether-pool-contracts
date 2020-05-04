pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./ControlledTokenFactory.sol";
import "./PeriodicPrizePoolFactory.sol";
import "./CompoundInterestPoolBuilder.sol";
import "./TicketFactory.sol";
import "./PrizeStrategyInterface.sol";
import "./compound/CTokenInterface.sol";

contract PrizePoolBuilder is Initializable {

  event PrizePoolCreated(
    address indexed creator,
    address indexed prizePool,
    address interestPool,
    address ticket,
    address distributionStrategy,
    uint256 prizePeriodSeconds
  );

  CompoundInterestPoolBuilder public compoundInterestPoolBuilder;
  PeriodicPrizePoolFactory public periodicPrizePoolFactory;
  TicketFactory public ticketFactory;
  ControlledTokenFactory public controlledTokenFactory;

  function initialize (
    CompoundInterestPoolBuilder _compoundInterestPoolBuilder,
    PeriodicPrizePoolFactory _periodicPrizePoolFactory,
    TicketFactory _ticketFactory,
    ControlledTokenFactory _controlledTokenFactory
  ) public initializer {
    require(address(_compoundInterestPoolBuilder) != address(0), "interest pool factory is not defined");
    require(address(_periodicPrizePoolFactory) != address(0), "prize pool factory is not defined");
    require(address(_ticketFactory) != address(0), "ticket factory is not defined");
    require(address(_controlledTokenFactory) != address(0), "controlled token factory is not defined");
    compoundInterestPoolBuilder = _compoundInterestPoolBuilder;
    periodicPrizePoolFactory = _periodicPrizePoolFactory;
    ticketFactory = _ticketFactory;
    controlledTokenFactory = _controlledTokenFactory;
  }

  function createPeriodicPrizePool(
    CTokenInterface cToken,
    DistributionStrategyInterface _distributionStrategy,
    uint256 prizePeriodSeconds,
    string memory _ticketName,
    string memory _ticketSymbol,
    string memory _sponsorshipName,
    string memory _sponsorshipSymbol
  ) public returns (PrizePool) {

    CompoundInterestPool interestPool = compoundInterestPoolBuilder.createCompoundInterestPool(cToken);
    PeriodicPrizePool prizePool = periodicPrizePoolFactory.createPeriodicPrizePool();
    Ticket ticket = ticketFactory.createTicket();
    ControlledToken sponsorship = controlledTokenFactory.createControlledToken();

    ticket.initialize(
      _ticketName,
      _ticketSymbol,
      prizePool
    );

    sponsorship.initialize(
      _sponsorshipName,
      _sponsorshipSymbol,
      prizePool
    );

    prizePool.initialize(
      ticket,
      sponsorship,
      interestPool,
      _distributionStrategy,
      prizePeriodSeconds
    );

    emit PrizePoolCreated(
      msg.sender,
      address(prizePool),
      address(interestPool),
      address(ticket),
      address(_distributionStrategy),
      prizePeriodSeconds
    );

    return prizePool;
  }
}
