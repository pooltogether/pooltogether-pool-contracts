pragma solidity ^0.6.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@pooltogether/governor-contracts/contracts/GovernorInterface.sol";

import "./PrizeStrategyProxyFactory.sol";
import "../prize-pool/compound/CompoundPrizePoolProxyFactory.sol";
import "../token/ControlledTokenProxyFactory.sol";
import "../external/compound/CTokenInterface.sol";

contract PrizeStrategyBuilder is Initializable {
  using SafeMath for uint256;

  struct Config {
    CTokenInterface cToken;
    uint256 prizePeriodSeconds;
    string ticketName;
    string ticketSymbol;
    string sponsorshipName;
    string sponsorshipSymbol;
    uint256 maxExitFeeMantissa;
    uint256 maxTimelockDuration;
    uint256 exitFeeMantissa;
    uint256 creditRateMantissa;
    address[] externalAwards;
  }

  event PrizeStrategyBuilt (
    address indexed creator,
    address indexed prizePool,
    address indexed prizeStrategy
  );

  GovernorInterface public governor;
  CompoundPrizePoolProxyFactory public compoundPrizePoolProxyFactory;
  ControlledTokenProxyFactory public controlledTokenProxyFactory;
  PrizeStrategyProxyFactory public prizeStrategyProxyFactory;
  RNGInterface public rng;
  address public trustedForwarder;

  function initialize (
    GovernorInterface _governor,
    PrizeStrategyProxyFactory _prizeStrategyProxyFactory,
    address _trustedForwarder,
    CompoundPrizePoolProxyFactory _compoundPrizePoolProxyFactory,
    ControlledTokenProxyFactory _controlledTokenProxyFactory,
    RNGInterface _rng
  ) public initializer {
    require(address(_governor) != address(0), "PrizeStrategyBuilder/governor-not-zero");
    require(address(_prizeStrategyProxyFactory) != address(0), "PrizeStrategyBuilder/prize-strategy-factory-not-zero");
    require(address(_compoundPrizePoolProxyFactory) != address(0), "PrizeStrategyBuilder/compound-prize-pool-builder-not-zero");
    require(address(_controlledTokenProxyFactory) != address(0), "PrizeStrategyBuilder/controlled-token-proxy-factory-not-zero");
    require(address(_rng) != address(0), "PrizeStrategyBuilder/rng-not-zero");
    rng = _rng;
    governor = _governor;
    prizeStrategyProxyFactory = _prizeStrategyProxyFactory;
    trustedForwarder = _trustedForwarder;
    compoundPrizePoolProxyFactory = _compoundPrizePoolProxyFactory;
    controlledTokenProxyFactory = _controlledTokenProxyFactory;
  }

  function create(Config calldata config) external returns (PrizeStrategy) {
    PrizeStrategy prizeStrategy = prizeStrategyProxyFactory.create();

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

    prizeStrategy.initialize(
      trustedForwarder,
      governor,
      config.prizePeriodSeconds,
      prizePool,
      tokens[0],
      tokens[1],
      rng,
      config.exitFeeMantissa,
      config.creditRateMantissa,
      config.externalAwards
    );

    emit PrizeStrategyBuilt(
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
