pragma solidity ^0.6.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@pooltogether/governor-contracts/contracts/GovernorInterface.sol";

import "./PrizeStrategyProxyFactory.sol";
import "../prize-pool/compound/CompoundPrizePoolProxyFactory.sol";
import "../token/ControlledTokenProxyFactory.sol";
import "../external/compound/CTokenInterface.sol";

contract PrizeStrategyBuilder is Initializable {

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

  function create(
    CTokenInterface _cToken,
    uint256 _prizePeriodSeconds,
    bytes memory ticketName,
    bytes memory ticketSymbol,
    bytes memory sponsorshipName,
    bytes memory sponsorshipSymbol,
    address[] memory externalAwards
  ) public returns (PrizeStrategy) {
    PrizeStrategy prizeStrategy = prizeStrategyProxyFactory.create();

    (CompoundPrizePool prizePool, address[] memory tokens) = createPrizePoolAndTokens(
      prizeStrategy,
      _cToken,
      ticketName,
      ticketSymbol,
      sponsorshipName,
      sponsorshipSymbol
    );

    prizeStrategy.initialize(
      trustedForwarder,
      governor,
      _prizePeriodSeconds,
      prizePool,
      tokens[0],
      tokens[1],
      rng,
      externalAwards
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
    bytes memory ticketName,
    bytes memory ticketSymbol,
    bytes memory sponsorshipName,
    bytes memory sponsorshipSymbol
  ) internal returns (CompoundPrizePool prizePool, address[] memory tokens) {
    prizePool = compoundPrizePoolProxyFactory.create();
    tokens = new address[](2);
    tokens[0] = address(createControlledToken(prizePool, ticketName, ticketSymbol));
    tokens[1] = address(createControlledToken(prizePool, sponsorshipName, sponsorshipSymbol));
    prizePool.initialize(
      trustedForwarder,
      prizeStrategy,
      tokens,
      _cToken
    );
  }

  function createControlledToken(
    TokenControllerInterface controller,
    bytes memory name,
    bytes memory symbol
  ) internal returns (ControlledToken) {
    ControlledToken token = controlledTokenProxyFactory.create();
    token.initialize(string(name), string(symbol), trustedForwarder, controller);
    return token;
  }

  function createPrizePool(
    PrizeStrategy prizeStrategy,
    CTokenInterface _cToken,
    ControlledToken ticket,
    ControlledToken sponsorship
  ) internal returns (CompoundPrizePool) {
    address[] memory tokens = new address[](2);
    tokens[0] = address(ticket);
    tokens[1] = address(sponsorship);
    CompoundPrizePool prizePool = compoundPrizePoolProxyFactory.create();
    prizePool.initialize(
      trustedForwarder,
      prizeStrategy,
      tokens,
      _cToken
    );
  }
}
