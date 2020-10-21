
// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "./PrizePoolBuilder.sol";
import "./SingleRandomWinnerBuilder.sol";
import "../registry/RegistryInterface.sol";
import "../prize-strategy/single-random-winner/SingleRandomWinnerProxyFactory.sol";
import "../prize-pool/aave/AavePrizePoolProxyFactory.sol";
import "../token/ControlledTokenProxyFactory.sol";
import "../token/TicketProxyFactory.sol";
import "../external/aave/ATokenInterface.sol";
import "../external/openzeppelin/OpenZeppelinProxyFactoryInterface.sol";

/// @title Builds new Aave Prize Pools
/* solium-disable security/no-block-members */
contract AavePrizePoolBuilder is PrizePoolBuilder {
  using SafeMath for uint256;
  using SafeCast for uint256;

  struct AavePrizePoolConfig {
    ATokenInterface aToken;
    uint256 maxExitFeeMantissa;
    uint256 maxTimelockDuration;
  }

  RegistryInterface public reserveRegistry;
  AavePrizePoolProxyFactory public aavePrizePoolProxyFactory;
  SingleRandomWinnerBuilder public singleRandomWinnerBuilder;
  address public trustedForwarder;
  address public lendingPoolAddressesProviderAddress;

  constructor (
    RegistryInterface _reserveRegistry,
    address _trustedForwarder,
    AavePrizePoolProxyFactory _aavePrizePoolProxyFactory,
    SingleRandomWinnerBuilder _singleRandomWinnerBuilder,
    address _lendingPoolAddressesProviderAddress
  ) public {
    require(address(_reserveRegistry) != address(0), "AavePrizePoolBuilder/reserveRegistry-not-zero");
    require(address(_singleRandomWinnerBuilder) != address(0), "AavePrizePoolBuilder/single-random-winner-builder-not-zero");
    require(address(_aavePrizePoolProxyFactory) != address(0), "AavePrizePoolBuilder/aave-prize-pool-builder-not-zero");
    reserveRegistry = _reserveRegistry;
    singleRandomWinnerBuilder = _singleRandomWinnerBuilder;
    trustedForwarder = _trustedForwarder;
    aavePrizePoolProxyFactory = _aavePrizePoolProxyFactory;
    lendingPoolAddressesProviderAddress = _lendingPoolAddressesProviderAddress;
  }

  function createSingleRandomWinner(
    AavePrizePoolConfig calldata prizePoolConfig,
    SingleRandomWinnerBuilder.SingleRandomWinnerConfig calldata prizeStrategyConfig,
    uint8 decimals
  ) external returns (AavePrizePool) {
    AavePrizePool prizePool = aavePrizePoolProxyFactory.create();

    SingleRandomWinner prizeStrategy = singleRandomWinnerBuilder.createSingleRandomWinner(
      prizePool,
      prizeStrategyConfig,
      decimals,
      msg.sender
    );

    address[] memory tokens;

    prizePool.initialize(
      trustedForwarder,
      reserveRegistry,
      tokens,
      prizePoolConfig.maxExitFeeMantissa,
      prizePoolConfig.maxTimelockDuration,
      prizePoolConfig.aToken,
      lendingPoolAddressesProviderAddress
    );

    _setupSingleRandomWinner(
      prizePool,
      prizeStrategy,
      prizeStrategyConfig.ticketCreditRateMantissa,
      prizeStrategyConfig.ticketCreditLimitMantissa
    );

    prizePool.transferOwnership(msg.sender);

    emit PrizePoolCreated(msg.sender, address(prizePool));

    return prizePool;
  }

  function createAavePrizePool(
    AavePrizePoolConfig calldata config
  )
    external
    returns (AavePrizePool)
  {
    AavePrizePool prizePool = aavePrizePoolProxyFactory.create();

    address[] memory tokens;

    prizePool.initialize(
      trustedForwarder,
      reserveRegistry,
      tokens,
      config.maxExitFeeMantissa,
      config.maxTimelockDuration,
      config.aToken,
      lendingPoolAddressesProviderAddress
    );

    prizePool.transferOwnership(msg.sender);

    emit PrizePoolCreated(msg.sender, address(prizePool));

    return prizePool;
  }
}
