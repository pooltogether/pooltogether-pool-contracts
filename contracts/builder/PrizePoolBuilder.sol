pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@pooltogether/governor-contracts/contracts/GovernorInterface.sol";

import "../token/ControlledTokenFactory.sol";
import "../ticket/TicketFactory.sol";
import "../periodic-prize-pool/CompoundPeriodicPrizePoolFactory.sol";
import "../external/compound/CTokenInterface.sol";

contract PrizePoolBuilder is Initializable {

  event PrizePoolCreated(
    address indexed creator,
    address indexed prizePool,
    address indexed prizeStrategy
  );

  GovernorInterface public governor;
  CompoundPeriodicPrizePoolFactory public periodicPrizePoolFactory;
  TicketFactory public ticketFactory;
  ControlledTokenFactory public controlledTokenFactory;
  RNGInterface public rng;
  address public trustedForwarder;

  function initialize (
    GovernorInterface _governor,
    CompoundPeriodicPrizePoolFactory _periodicPrizePoolFactory,
    TicketFactory _ticketFactory,
    ControlledTokenFactory _controlledTokenFactory,
    RNGInterface _rng,
    address _trustedForwarder
  ) public initializer {
    require(address(_governor) != address(0), "governor cannot be zero");
    require(address(_periodicPrizePoolFactory) != address(0), "prize pool factory cannot be zero");
    require(address(_ticketFactory) != address(0), "ticket factory cannot be zero");
    require(address(_rng) != address(0), "rng cannot be zero");
    require(address(_controlledTokenFactory) != address(0), "controlled token factory cannot be zero");
    governor = _governor;
    periodicPrizePoolFactory = _periodicPrizePoolFactory;
    ticketFactory = _ticketFactory;
    controlledTokenFactory = _controlledTokenFactory;
    rng = _rng;
    trustedForwarder = _trustedForwarder;
  }

  function createPeriodicPrizePool(
    CTokenInterface _cToken,
    PrizeStrategyInterface _prizeStrategy,
    uint256 _prizePeriodSeconds,
    string memory _ticketName,
    string memory _ticketSymbol,
    string memory _sponsorshipName,
    string memory _sponsorshipSymbol
  ) public returns (CompoundPeriodicPrizePool) {
    CompoundPeriodicPrizePool prizePool = periodicPrizePoolFactory.createCompoundPeriodicPrizePool();

    initializePrizePool(
      prizePool,
      _cToken,
      _prizeStrategy,
      _prizePeriodSeconds
    );

    setTokens(
      prizePool,
      _ticketName,
      _ticketSymbol,
      _sponsorshipName,
      _sponsorshipSymbol
    );

    emit PrizePoolCreated(
      msg.sender,
      address(prizePool),
      address(_prizeStrategy)
    );

    return prizePool;
  }

  function initializePrizePool(
    CompoundPeriodicPrizePool prizePool,
    CTokenInterface _cToken,
    PrizeStrategyInterface _prizeStrategy,
    uint256 _prizePeriodSeconds
  ) internal {
    prizePool.initialize(
      trustedForwarder,
      governor,
      _prizeStrategy,
      rng,
      _prizePeriodSeconds,
      _cToken
    );
  }

  function setTokens(
    CompoundPeriodicPrizePool prizePool,
    string memory _ticketName,
    string memory _ticketSymbol,
    string memory _sponsorshipName,
    string memory _sponsorshipSymbol
  ) internal {
    prizePool.setTokens(
      createTicket(prizePool, _ticketName, _ticketSymbol),
      createSponsorship(prizePool, _sponsorshipName, _sponsorshipSymbol),
      createTicketCredit(prizePool),
      createSponsorshipCredit(prizePool)
    );
  }

  function createTicketCredit(
    PeriodicPrizePool prizePool
  ) internal returns (ControlledToken) {
    ControlledToken credit = controlledTokenFactory.createControlledToken();
    address[] memory defaultOperators;
    credit.initialize("Ticket Credit", "TCRD", defaultOperators, trustedForwarder, prizePool);
    return credit;
  }

  function createSponsorshipCredit(
    PeriodicPrizePool prizePool
  ) internal returns (ControlledToken) {
    ControlledToken credit = controlledTokenFactory.createControlledToken();
    address[] memory defaultOperators;
    credit.initialize("Sponsorship Credit", "SCRD", defaultOperators, trustedForwarder, prizePool);
    return credit;
  }

  function createTicket(
    PeriodicPrizePool prizePool,
    string memory _ticketName,
    string memory _ticketSymbol
  ) internal returns (Ticket) {
    Ticket ticket = ticketFactory.createTicket();
    address[] memory defaultOperators;
    ticket.initialize(_ticketName, _ticketSymbol, defaultOperators, trustedForwarder, prizePool);
    return ticket;
  }

  function createSponsorship(
    PeriodicPrizePool prizePool,
    string memory _sponsorshipName,
    string memory _sponsorshipSymbol
  ) internal returns (ControlledToken) {
    ControlledToken sponsorship = controlledTokenFactory.createControlledToken();
    address[] memory defaultOperators;
    sponsorship.initialize(_sponsorshipName, _sponsorshipSymbol, defaultOperators, trustedForwarder, prizePool);
    return sponsorship;
  }
}
