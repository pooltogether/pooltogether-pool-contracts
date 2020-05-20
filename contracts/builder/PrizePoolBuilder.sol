pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "../token/ControlledTokenFactory.sol";
import "../token/SponsorshipFactory.sol";
import "../prize-pool/PeriodicPrizePoolFactory.sol";
import "../yield-service/CompoundYieldServiceFactory.sol";
import "../token/TicketFactory.sol";
import "../external/compound/CTokenInterface.sol";

contract PrizePoolBuilder is Initializable {

  event PrizePoolCreated(
    address indexed creator,
    address indexed prizePool,
    address yieldService,
    address ticket,
    address prizeStrategy,
    uint256 prizePeriodSeconds
  );

  CompoundYieldServiceFactory public compoundYieldServiceFactory;
  PeriodicPrizePoolFactory public periodicPrizePoolFactory;
  TicketFactory public ticketFactory;
  ControlledTokenFactory public controlledTokenFactory;
  SponsorshipFactory public sponsorshipFactory;
  RNGInterface public rng;
  address public trustedForwarder;

  function initialize (
    CompoundYieldServiceFactory _compoundYieldServiceFactory,
    PeriodicPrizePoolFactory _periodicPrizePoolFactory,
    TicketFactory _ticketFactory,
    ControlledTokenFactory _controlledTokenFactory,
    SponsorshipFactory _sponsorshipFactory,
    RNGInterface _rng,
    address _trustedForwarder
  ) public initializer {
    require(address(_compoundYieldServiceFactory) != address(0), "interest pool factory is not defined");
    require(address(_periodicPrizePoolFactory) != address(0), "prize pool factory is not defined");
    require(address(_ticketFactory) != address(0), "ticket factory is not defined");
    require(address(_rng) != address(0), "rng cannot be zero");
    require(address(_sponsorshipFactory) != address(0), "sponsorship factory cannot be zero");
    require(address(_controlledTokenFactory) != address(0), "controlled token factory cannot be zero");
    compoundYieldServiceFactory = _compoundYieldServiceFactory;
    periodicPrizePoolFactory = _periodicPrizePoolFactory;
    ticketFactory = _ticketFactory;
    rng = _rng;
    trustedForwarder = _trustedForwarder;
    sponsorshipFactory = _sponsorshipFactory;
    controlledTokenFactory = _controlledTokenFactory;
  }

  function createPeriodicPrizePool(
    CTokenInterface cToken,
    PrizeStrategyInterface _prizeStrategy,
    uint256 prizePeriodSeconds,
    string memory _ticketName,
    string memory _ticketSymbol,
    string memory _sponsorshipName,
    string memory _sponsorshipSymbol
  ) public returns (PeriodicPrizePool) {
    PeriodicPrizePool prizePool = periodicPrizePoolFactory.createPeriodicPrizePool();

    prizePool.initialize(
      trustedForwarder,
      _prizeStrategy,
      rng,
      prizePeriodSeconds
    );

    createCompoundYieldServiceModule(prizePool, cToken);
    createTicketModule(prizePool, _ticketName, _ticketSymbol);
    createSponsorshipModule(prizePool, _sponsorshipName, _sponsorshipSymbol);

    emit PrizePoolCreated(
      msg.sender,
      address(prizePool),
      address(prizePool.yieldService()),
      address(prizePool.ticket()),
      address(_prizeStrategy),
      prizePeriodSeconds
    );

    return prizePool;
  }

  function createCompoundYieldServiceModule(ModuleManager moduleManager, CTokenInterface cToken) internal {
    CompoundYieldService yieldService = compoundYieldServiceFactory.createCompoundYieldService();
    moduleManager.enableModule(yieldService);
    yieldService.initialize(moduleManager, cToken);
  }

  function createTicketModule(
    ModuleManager moduleManager,
    string memory _ticketName,
    string memory _ticketSymbol
  ) internal {
    Ticket ticket = ticketFactory.createTicket();
    moduleManager.enableModule(ticket);
    ControlledToken timelock = controlledTokenFactory.createControlledToken("", "", address(ticket), trustedForwarder);
    ticket.initialize(moduleManager, _ticketName, _ticketSymbol, timelock, trustedForwarder);
  }

  function createSponsorshipModule(
    ModuleManager moduleManager,
    string memory _sponsorshipName,
    string memory _sponsorshipSymbol
  ) internal {
    Sponsorship sponsorship = sponsorshipFactory.createSponsorship();
    moduleManager.enableModule(sponsorship);
    sponsorship.initialize(moduleManager, _sponsorshipName, _sponsorshipSymbol, trustedForwarder);
  }
}
