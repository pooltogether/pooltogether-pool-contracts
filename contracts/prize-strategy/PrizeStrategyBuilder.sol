pragma solidity ^0.6.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@pooltogether/governor-contracts/contracts/GovernorInterface.sol";

import "./PrizeStrategyProxyFactory.sol";
import "../prize-pool/compound/CompoundPrizePoolBuilder.sol";
import "../token/ControlledTokenProxyFactory.sol";
import "../external/compound/CTokenInterface.sol";

contract PrizeStrategyBuilder is Initializable {

  event PrizeStrategyBuilt (
    address indexed creator,
    address indexed prizePool,
    address indexed prizeStrategy
  );

  GovernorInterface public governor;
  CompoundPrizePoolBuilder public compoundPrizePoolBuilder;
  PrizeStrategyProxyFactory public prizeStrategyProxyFactory;
  RNGInterface public rng;
  address public trustedForwarder;

  function initialize (
    GovernorInterface _governor,
    PrizeStrategyProxyFactory _prizeStrategyProxyFactory,
    address _trustedForwarder,
    CompoundPrizePoolBuilder _compoundPrizePoolBuilder,
    RNGInterface _rng
  ) public initializer {
    require(address(_governor) != address(0), "PrizeStrategyBuilder/governor-not-zero");
    require(address(_prizeStrategyProxyFactory) != address(0), "PrizeStrategyBuilder/prize-strategy-factory-not-zero");
    require(address(_compoundPrizePoolBuilder) != address(0), "PrizeStrategyBuilder/compound-prize-pool-builder-zero");
    require(address(_rng) != address(0), "PrizeStrategyBuilder/rng-not-zero");
    rng = _rng;
    governor = _governor;
    prizeStrategyProxyFactory = _prizeStrategyProxyFactory;
    trustedForwarder = _trustedForwarder;
    compoundPrizePoolBuilder = _compoundPrizePoolBuilder;
  }

  function create(
    CTokenInterface _cToken,
    uint256 _prizePeriodSeconds,
    address[] memory externalAwards
  ) public returns (PrizeStrategy) {
    PrizeStrategy prizeStrategy = prizeStrategyProxyFactory.create();

    (CompoundPrizePool prizePool, address[] memory tokens) = createPrizePool(
      prizeStrategy,
      _cToken
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

  function createPrizePool(
    PrizeStrategy prizeStrategy,
    CTokenInterface _cToken
  ) internal returns (CompoundPrizePool, address[] memory) {
    CompoundPrizePoolBuilder.TokenDetails[] memory tokenDetails = new CompoundPrizePoolBuilder.TokenDetails[](2);

    tokenDetails[0] = CompoundPrizePoolBuilder.TokenDetails({ name: "Ticket", symbol: "TCKT" });
    tokenDetails[1] = CompoundPrizePoolBuilder.TokenDetails({ name: "Sponsorship", symbol: "SPSR" });

    return compoundPrizePoolBuilder.create(
      prizeStrategy,
      _cToken,
      tokenDetails
    );
  }
}
