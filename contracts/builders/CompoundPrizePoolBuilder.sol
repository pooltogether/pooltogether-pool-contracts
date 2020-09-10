pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../comptroller/ComptrollerInterface.sol";
import "../prize-strategy/single-random-winner/SingleRandomWinnerProxyFactory.sol";
import "../prize-pool/compound/CompoundPrizePoolProxyFactory.sol";
import "../token/ControlledTokenProxyFactory.sol";
import "../token/TicketProxyFactory.sol";
import "../external/compound/CTokenInterface.sol";
import "../external/openzeppelin/OpenZeppelinProxyFactoryInterface.sol";

/* solium-disable security/no-block-members */
contract CompoundPrizePoolBuilder {
  using SafeMath for uint256;
  using SafeCast for uint256;

  struct Config {
    address proxyAdmin;
    CTokenInterface cToken;
    RNGInterface rngService;
    uint256 prizePeriodStart;
    uint256 prizePeriodSeconds;
    string ticketName;
    string ticketSymbol;
    string sponsorshipName;
    string sponsorshipSymbol;
    uint256 maxExitFeeMantissa;
    uint256 maxTimelockDuration;
    uint256 creditLimitMantissa;
    uint256 creditRateMantissa;
    address[] externalERC20Awards;
  }

  event CompoundPrizePoolCreated (
    address indexed creator,
    address indexed prizePool,
    address indexed prizeStrategy,
    address ticket,
    address sponsorship
  );

  ComptrollerInterface public comptroller;
  CompoundPrizePoolProxyFactory public compoundPrizePoolProxyFactory;
  ControlledTokenProxyFactory public controlledTokenProxyFactory;
  TicketProxyFactory public ticketProxyFactory;
  SingleRandomWinnerProxyFactory public singleRandomWinnerProxyFactory;
  OpenZeppelinProxyFactoryInterface public proxyFactory;
  address public trustedForwarder;

  constructor (
    ComptrollerInterface _comptroller,
    SingleRandomWinnerProxyFactory _singleRandomWinnerProxyFactory,
    address _trustedForwarder,
    CompoundPrizePoolProxyFactory _compoundPrizePoolProxyFactory,
    ControlledTokenProxyFactory _controlledTokenProxyFactory,
    OpenZeppelinProxyFactoryInterface _proxyFactory,
    TicketProxyFactory _ticketProxyFactory
  ) public {
    require(address(_comptroller) != address(0), "CompoundPrizePoolBuilder/comptroller-not-zero");
    require(address(_singleRandomWinnerProxyFactory) != address(0), "CompoundPrizePoolBuilder/single-random-winner-factory-not-zero");
    require(address(_compoundPrizePoolProxyFactory) != address(0), "CompoundPrizePoolBuilder/compound-prize-pool-builder-not-zero");
    require(address(_controlledTokenProxyFactory) != address(0), "CompoundPrizePoolBuilder/controlled-token-proxy-factory-not-zero");
    require(address(_proxyFactory) != address(0), "CompoundPrizePoolBuilder/proxy-factory-not-zero");
    require(address(_ticketProxyFactory) != address(0), "CompoundPrizePoolBuilder/ticket-proxy-factory-not-zero");
    proxyFactory = _proxyFactory;
    ticketProxyFactory = _ticketProxyFactory;
    comptroller = _comptroller;
    singleRandomWinnerProxyFactory = _singleRandomWinnerProxyFactory;
    trustedForwarder = _trustedForwarder;
    compoundPrizePoolProxyFactory = _compoundPrizePoolProxyFactory;
    controlledTokenProxyFactory = _controlledTokenProxyFactory;
  }

  function create(Config calldata config) external returns (SingleRandomWinner) {
    SingleRandomWinner prizeStrategy;
    if (config.proxyAdmin != address(0)) {
      prizeStrategy = SingleRandomWinner(
        proxyFactory.deploy(block.timestamp, address(singleRandomWinnerProxyFactory.instance()), config.proxyAdmin, "")
      );
    } else {
      prizeStrategy = singleRandomWinnerProxyFactory.create();
    }

    CompoundPrizePool prizePool = compoundPrizePoolProxyFactory.create();
    address[] memory tokens = createTokens(
      prizePool,
      config.ticketName,
      config.ticketSymbol,
      config.sponsorshipName,
      config.sponsorshipSymbol
    );

    prizePool.initialize(
      trustedForwarder,
      prizeStrategy,
      comptroller,
      tokens,
      config.maxExitFeeMantissa,
      config.maxTimelockDuration,
      config.cToken
    );

    prizePool.setCreditRateOf(tokens[0], config.creditRateMantissa.toUint128(), config.creditLimitMantissa.toUint128());

    prizePool.setReserveFeeControlledToken(tokens[1]);

    prizePool.transferOwnership(msg.sender);

    prizeStrategy.initialize(
      trustedForwarder,
      config.prizePeriodStart,
      config.prizePeriodSeconds,
      prizePool,
      tokens[0],
      tokens[1],
      config.rngService,
      config.externalERC20Awards
    );

    prizeStrategy.transferOwnership(msg.sender);

    emit CompoundPrizePoolCreated(msg.sender, address(prizePool), address(prizeStrategy), tokens[0], tokens[1]);

    return prizeStrategy;
  }

  function createTokens(
    PrizePool prizePool,
    string memory ticketName,
    string memory ticketSymbol,
    string memory sponsorshipName,
    string memory sponsorshipSymbol
  ) internal returns (address[] memory) {
    address[] memory tokens = new address[](2);
    tokens[0] = address(createTicket(prizePool, ticketName, ticketSymbol));
    tokens[1] = address(createControlledToken(prizePool, sponsorshipName, sponsorshipSymbol));
    return tokens;
  }

  function createControlledToken(
    TokenControllerInterface controller,
    string memory name,
    string memory symbol
  ) internal returns (ControlledToken) {
    ControlledToken token = controlledTokenProxyFactory.create();
    token.initialize(string(name), string(symbol), trustedForwarder, controller);
    return token;
  }

  function createTicket(
    TokenControllerInterface controller,
    string memory name,
    string memory symbol
  ) internal returns (Ticket) {
    Ticket ticket = ticketProxyFactory.create();
    ticket.initialize(string(name), string(symbol), trustedForwarder, controller);
    return ticket;
  }
}
