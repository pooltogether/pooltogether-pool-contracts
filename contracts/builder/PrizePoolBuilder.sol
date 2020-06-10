pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@pooltogether/governor-contracts/contracts/GovernorInterface.sol";

import "../module-manager/PrizePoolModuleManagerFactory.sol";
import "../modules/timelock/TimelockFactory.sol";
import "../modules/sponsorship/SponsorshipFactory.sol";
import "../modules/credit/CreditFactory.sol";
import "../modules/yield-service/CompoundYieldServiceFactory.sol";
import "../modules/ticket/TicketFactory.sol";
import "../modules/periodic-prize-pool/PeriodicPrizePoolFactory.sol";
import "../modules/interest-tracker/InterestTrackerFactory.sol";
import "../external/compound/CTokenInterface.sol";

contract PrizePoolBuilder is Initializable {

  event PrizePoolCreated(
    address indexed creator,
    address indexed moduleManager,
    address indexed prizeStrategy
  );

  PrizePoolModuleManagerFactory public prizePoolModuleManagerFactory;
  GovernorInterface public governor;
  CompoundYieldServiceFactory public compoundYieldServiceFactory;
  PeriodicPrizePoolFactory public periodicPrizePoolFactory;
  TicketFactory public ticketFactory;
  CreditFactory public creditFactory;
  TimelockFactory public timelockFactory;
  SponsorshipFactory public sponsorshipFactory;
  InterestTrackerFactory public interestTrackerFactory;
  RNGInterface public rng;
  address public trustedForwarder;

  function initialize (
    PrizePoolModuleManagerFactory _prizePoolModuleManagerFactory,
    GovernorInterface _governor,
    CompoundYieldServiceFactory _compoundYieldServiceFactory,
    PeriodicPrizePoolFactory _periodicPrizePoolFactory,
    TicketFactory _ticketFactory,
    TimelockFactory _timelockFactory,
    SponsorshipFactory _sponsorshipFactory,
    CreditFactory _creditFactory,
    InterestTrackerFactory _interestTrackerFactory,
    RNGInterface _rng,
    address _trustedForwarder
  ) public initializer {
    require(address(_prizePoolModuleManagerFactory) != address(0), "module factory cannot be zero");
    require(address(_governor) != address(0), "governor cannot be zero");
    require(address(_compoundYieldServiceFactory) != address(0), "interest pool factory cannot be zero");
    require(address(_periodicPrizePoolFactory) != address(0), "prize pool factory cannot be zero");
    require(address(_ticketFactory) != address(0), "ticket factory cannot be zero");
    require(address(_rng) != address(0), "rng cannot be zero");
    require(address(_sponsorshipFactory) != address(0), "sponsorship factory cannot be zero");
    require(address(_timelockFactory) != address(0), "controlled token factory cannot be zero");
    require(address(_creditFactory) != address(0), "credit factory cannot be zero");
    require(address(_interestTrackerFactory) != address(0), "interest tracker factory cannot be zero");
    interestTrackerFactory = _interestTrackerFactory;
    prizePoolModuleManagerFactory = _prizePoolModuleManagerFactory;
    governor = _governor;
    compoundYieldServiceFactory = _compoundYieldServiceFactory;
    periodicPrizePoolFactory = _periodicPrizePoolFactory;
    ticketFactory = _ticketFactory;
    creditFactory = _creditFactory;
    rng = _rng;
    trustedForwarder = _trustedForwarder;
    sponsorshipFactory = _sponsorshipFactory;
    timelockFactory = _timelockFactory;
  }

  function createPeriodicPrizePool(
    CTokenInterface _cToken,
    PrizeStrategyInterface _prizeStrategy,
    uint256 _prizePeriodSeconds,
    string memory _ticketName,
    string memory _ticketSymbol,
    string memory _sponsorshipName,
    string memory _sponsorshipSymbol
  ) public returns (PrizePoolModuleManager) {
    PrizePoolModuleManager manager = prizePoolModuleManagerFactory.createPrizePoolModuleManager();
    manager.initialize(trustedForwarder);

    createPeriodicPrizePoolModule(manager, _prizeStrategy, _prizePeriodSeconds);
    createCompoundYieldServiceModule(manager, _cToken);
    createCreditModule(manager);
    createTimelockModule(manager);
    createTicketModule(manager, _ticketName, _ticketSymbol);
    createSponsorshipModule(manager, _sponsorshipName, _sponsorshipSymbol);
    createInterestTrackerModule(manager);

    emit PrizePoolCreated(
      msg.sender,
      address(manager),
      address(_prizeStrategy)
    );

    return manager;
  }

  function createInterestTrackerModule(
    NamedModuleManager _moduleManager
  ) internal {
    InterestTracker interestTracker = interestTrackerFactory.createInterestTracker();
    _moduleManager.enableModule(interestTracker);
    interestTracker.initialize(_moduleManager, trustedForwarder);
  }

  function createPeriodicPrizePoolModule(
    NamedModuleManager _moduleManager,
    PrizeStrategyInterface _prizeStrategy,
    uint256 _prizePeriodSeconds
  ) internal {
    PeriodicPrizePool prizePool = periodicPrizePoolFactory.createPeriodicPrizePool();
    _moduleManager.enableModule(prizePool);
    prizePool.initialize(
      _moduleManager,
      trustedForwarder,
      governor,
      _prizeStrategy,
      rng,
      _prizePeriodSeconds
    );
  }

  function createCompoundYieldServiceModule(
    NamedModuleManager moduleManager,
    CTokenInterface cToken
  ) internal {
    CompoundYieldService yieldService = compoundYieldServiceFactory.createCompoundYieldService();
    moduleManager.enableModule(yieldService);
    yieldService.initialize(moduleManager, cToken);
  }

  function createCreditModule(
    NamedModuleManager moduleManager
  ) internal {
    Credit credit = creditFactory.createCredit();
    moduleManager.enableModule(credit);
    credit.initialize(moduleManager, trustedForwarder, "Credit", "CRDT");
  }

  function createTicketModule(
    NamedModuleManager moduleManager,
    string memory _ticketName,
    string memory _ticketSymbol
  ) internal {
    Ticket ticket = ticketFactory.createTicket();
    moduleManager.enableModule(ticket);
    ticket.initialize(moduleManager, trustedForwarder, _ticketName, _ticketSymbol);
  }

  function createTimelockModule(
    NamedModuleManager moduleManager
  ) internal {
    Timelock timelock = timelockFactory.createTimelock();
    moduleManager.enableModule(timelock);
    timelock.initialize(moduleManager, trustedForwarder, "", "");
  }

  function createSponsorshipModule(
    NamedModuleManager moduleManager,
    string memory _sponsorshipName,
    string memory _sponsorshipSymbol
  ) internal {
    Sponsorship sponsorship = sponsorshipFactory.createSponsorship();
    moduleManager.enableModule(sponsorship);
    sponsorship.initialize(moduleManager, trustedForwarder, _sponsorshipName, _sponsorshipSymbol);
  }
}
