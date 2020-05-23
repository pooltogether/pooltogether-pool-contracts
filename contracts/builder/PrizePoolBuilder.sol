pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "../base/OwnableModuleManagerFactory.sol";
import "../modules/timelock/TimelockFactory.sol";
import "../modules/sponsorship/SponsorshipFactory.sol";
import "../modules/loyalty/LoyaltyFactory.sol";
import "../modules/yield-service/CompoundYieldServiceFactory.sol";
import "../modules/ticket/TicketFactory.sol";
import "../modules/periodic-prize-pool/PeriodicPrizePoolFactory.sol";
import "../external/compound/CTokenInterface.sol";

contract PrizePoolBuilder is Initializable {

  event PrizePoolCreated(
    address indexed creator,
    address indexed moduleManager,
    address indexed prizeStrategy
  );

  OwnableModuleManagerFactory public ownableModuleManagerFactory;
  ProtocolGovernor public governor;
  CompoundYieldServiceFactory public compoundYieldServiceFactory;
  PeriodicPrizePoolFactory public periodicPrizePoolFactory;
  TicketFactory public ticketFactory;
  LoyaltyFactory public loyaltyFactory;
  TimelockFactory public timelockFactory;
  SponsorshipFactory public sponsorshipFactory;
  RNGInterface public rng;
  address public trustedForwarder;

  function initialize (
    OwnableModuleManagerFactory _ownableModuleManagerFactory,
    ProtocolGovernor _governor,
    CompoundYieldServiceFactory _compoundYieldServiceFactory,
    PeriodicPrizePoolFactory _periodicPrizePoolFactory,
    TicketFactory _ticketFactory,
    TimelockFactory _timelockFactory,
    SponsorshipFactory _sponsorshipFactory,
    LoyaltyFactory _loyaltyFactory,
    RNGInterface _rng,
    address _trustedForwarder
  ) public initializer {
    require(address(_ownableModuleManagerFactory) != address(0), "module factory cannot be zero");
    require(address(_governor) != address(0), "governor cannot be zero");
    require(address(_compoundYieldServiceFactory) != address(0), "interest pool factory is not defined");
    require(address(_periodicPrizePoolFactory) != address(0), "prize pool factory is not defined");
    require(address(_ticketFactory) != address(0), "ticket factory is not defined");
    require(address(_rng) != address(0), "rng cannot be zero");
    require(address(_sponsorshipFactory) != address(0), "sponsorship factory cannot be zero");
    require(address(_timelockFactory) != address(0), "controlled token factory cannot be zero");
    require(address(_loyaltyFactory) != address(0), "loyalty factory is not zero");
    ownableModuleManagerFactory = _ownableModuleManagerFactory;
    governor = _governor;
    compoundYieldServiceFactory = _compoundYieldServiceFactory;
    periodicPrizePoolFactory = _periodicPrizePoolFactory;
    ticketFactory = _ticketFactory;
    loyaltyFactory = _loyaltyFactory;
    rng = _rng;
    trustedForwarder = _trustedForwarder;
    sponsorshipFactory = _sponsorshipFactory;
    timelockFactory = _timelockFactory;
  }

  function createPeriodicPrizePool(
    CTokenInterface cToken,
    PrizeStrategyInterface _prizeStrategy,
    uint256 prizePeriodSeconds,
    string memory _ticketName,
    string memory _ticketSymbol,
    string memory _sponsorshipName,
    string memory _sponsorshipSymbol
  ) public returns (OwnableModuleManager) {
    OwnableModuleManager manager = ownableModuleManagerFactory.createOwnableModuleManager();
    manager.initialize(trustedForwarder);

    createPeriodicPrizePoolModule(manager, _prizeStrategy, prizePeriodSeconds);
    createCompoundYieldServiceModule(manager, cToken);
    createLoyaltyModule(manager);
    createTimelockModule(manager);
    createTicketModule(manager, _ticketName, _ticketSymbol);
    createSponsorshipModule(manager, _sponsorshipName, _sponsorshipSymbol);

    emit PrizePoolCreated(
      msg.sender,
      address(manager),
      address(_prizeStrategy)
    );

    return manager;
  }

  function createPeriodicPrizePoolModule(
    ModuleManager _moduleManager,
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
    ModuleManager moduleManager,
    CTokenInterface cToken
  ) internal {
    CompoundYieldService yieldService = compoundYieldServiceFactory.createCompoundYieldService();
    moduleManager.enableModule(yieldService);
    yieldService.initialize(moduleManager, cToken);
  }

  function createLoyaltyModule(
    ModuleManager moduleManager
  ) internal {
    Loyalty loyalty = loyaltyFactory.createLoyalty();
    moduleManager.enableModule(loyalty);
    loyalty.initialize(moduleManager, trustedForwarder, "", "");
  }

  function createTicketModule(
    ModuleManager moduleManager,
    string memory _ticketName,
    string memory _ticketSymbol
  ) internal {
    Ticket ticket = ticketFactory.createTicket();
    moduleManager.enableModule(ticket);
    ticket.initialize(moduleManager, trustedForwarder, _ticketName, _ticketSymbol);
  }

  function createTimelockModule(
    ModuleManager moduleManager
  ) internal {
    Timelock timelock = timelockFactory.createTimelock();
    moduleManager.enableModule(timelock);
    timelock.initialize(moduleManager, trustedForwarder, "", "");
  }

  function createSponsorshipModule(
    ModuleManager moduleManager,
    string memory _sponsorshipName,
    string memory _sponsorshipSymbol
  ) internal {
    Sponsorship sponsorship = sponsorshipFactory.createSponsorship();
    moduleManager.enableModule(sponsorship);
    sponsorship.initialize(moduleManager, trustedForwarder, _sponsorshipName, _sponsorshipSymbol);
  }
}
