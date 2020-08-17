pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "../comptroller/ComptrollerInterface.sol";
import "../prize-strategy/PrizeStrategyProxyFactory.sol";
import "../prize-pool/compound/CompoundPrizePoolProxyFactory.sol";
import "../token/ControlledTokenProxyFactory.sol";
import "../external/compound/CTokenInterface.sol";
import "../external/openzeppelin/OpenZeppelinProxyFactoryInterface.sol";

/* solium-disable security/no-block-members */
contract CompoundPrizePoolBuilder {
  using SafeMath for uint256;

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
    uint256 exitFeeMantissa;
    uint256 creditRateMantissa;
    address[] externalERC20Awards;
  }

  event CompoundPrizePoolCreated (
    address indexed creator,
    address indexed prizePool,
    address indexed prizeStrategy
  );

  ComptrollerInterface public comptroller;
  CompoundPrizePoolProxyFactory public compoundPrizePoolProxyFactory;
  ControlledTokenProxyFactory public controlledTokenProxyFactory;
  PrizeStrategyProxyFactory public prizeStrategyProxyFactory;
  OpenZeppelinProxyFactoryInterface public proxyFactory;
  address public trustedForwarder;

  constructor (
    ComptrollerInterface _comptroller,
    PrizeStrategyProxyFactory _prizeStrategyProxyFactory,
    address _trustedForwarder,
    CompoundPrizePoolProxyFactory _compoundPrizePoolProxyFactory,
    ControlledTokenProxyFactory _controlledTokenProxyFactory,
    OpenZeppelinProxyFactoryInterface _proxyFactory
  ) public {
    require(address(_comptroller) != address(0), "CompoundPrizePoolBuilder/comptroller-not-zero");
    require(address(_prizeStrategyProxyFactory) != address(0), "CompoundPrizePoolBuilder/prize-strategy-factory-not-zero");
    require(address(_compoundPrizePoolProxyFactory) != address(0), "CompoundPrizePoolBuilder/compound-prize-pool-builder-not-zero");
    require(address(_controlledTokenProxyFactory) != address(0), "CompoundPrizePoolBuilder/controlled-token-proxy-factory-not-zero");
    require(address(_proxyFactory) != address(0), "CompoundPrizePoolBuilder/proxy-factory-not-zero");
    proxyFactory = _proxyFactory;
    comptroller = _comptroller;
    prizeStrategyProxyFactory = _prizeStrategyProxyFactory;
    trustedForwarder = _trustedForwarder;
    compoundPrizePoolProxyFactory = _compoundPrizePoolProxyFactory;
    controlledTokenProxyFactory = _controlledTokenProxyFactory;
  }

  function create(Config calldata config) external returns (PrizeStrategy) {
    PrizeStrategy prizeStrategy;
    if (config.proxyAdmin != address(0)) {
      prizeStrategy = PrizeStrategy(
        proxyFactory.deploy(block.timestamp, address(prizeStrategyProxyFactory.instance()), config.proxyAdmin, "")
      );
    } else {
      prizeStrategy = prizeStrategyProxyFactory.create();
    }

    (CompoundPrizePool prizePool, address[] memory tokens) = createPrizePoolAndTokens(
      prizeStrategy,
      config.cToken,
      config.ticketName,
      config.ticketSymbol,
      config.sponsorshipName,
      config.sponsorshipSymbol,
      config.maxExitFeeMantissa,
      config.maxTimelockDuration
    );

    prizePool.transferOwnership(msg.sender);

    prizeStrategy.initialize(
      trustedForwarder,
      comptroller,
      config.prizePeriodStart,
      config.prizePeriodSeconds,
      prizePool,
      tokens[0],
      tokens[1],
      config.rngService,
      config.externalERC20Awards
    );

    prizeStrategy.setExitFeeMantissa(config.exitFeeMantissa);
    prizeStrategy.setCreditRateMantissa(config.creditRateMantissa);

    prizeStrategy.transferOwnership(msg.sender);

    emit CompoundPrizePoolCreated(
      msg.sender,
      address(prizePool),
      address(prizeStrategy)
    );

    return prizeStrategy;
  }

  function createPrizePoolAndTokens(
    PrizeStrategy prizeStrategy,
    CTokenInterface _cToken,
    string memory ticketName,
    string memory ticketSymbol,
    string memory sponsorshipName,
    string memory sponsorshipSymbol,
    uint256 _maxExitFeeMantissa,
    uint256 _maxTimelockDuration
  ) internal returns (CompoundPrizePool prizePool, address[] memory tokens) {
    prizePool = compoundPrizePoolProxyFactory.create();
    tokens = new address[](2);
    tokens[0] = address(createControlledToken(prizePool, ticketName, ticketSymbol));
    tokens[1] = address(createControlledToken(prizePool, sponsorshipName, sponsorshipSymbol));
    prizePool.initialize(
      trustedForwarder,
      prizeStrategy,
      tokens,
      _maxExitFeeMantissa,
      _maxTimelockDuration,
      _cToken
    );
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
}
