
// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "./PrizePoolBuilder.sol";
import "./SingleRandomWinnerBuilder.sol";
import "../comptroller/ComptrollerInterface.sol";
import "../prize-strategy/single-random-winner/SingleRandomWinnerProxyFactory.sol";
import "../prize-pool/aave/AavePrizePoolProxyFactory.sol";
import "../token/ControlledTokenProxyFactory.sol";
import "../token/TicketProxyFactory.sol";
import "../external/openzeppelin/OpenZeppelinProxyFactoryInterface.sol";

/// @title Builds new Aave Prize Pools
/* solium-disable security/no-block-members */
contract AavePrizePoolBuilder is PrizePoolBuilder {
  using SafeMath for uint256;
  using SafeCast for uint256;

  struct AavePrizePoolConfig {
    address aToken;
    uint256 maxExitFeeMantissa;
    uint256 maxTimelockDuration;
  }

  ComptrollerInterface public comptroller;
  AavePrizePoolProxyFactory public aavePrizePoolProxyFactory;
  SingleRandomWinnerBuilder public singleRandomWinnerBuilder;
  address public trustedForwarder;
  address public lendingPoolAddressesProviderAddress;

  constructor (
    ComptrollerInterface _comptroller,
    address _trustedForwarder,
    AavePrizePoolProxyFactory _aavePrizePoolProxyFactory,
    SingleRandomWinnerBuilder _singleRandomWinnerBuilder,
    address _lendingPoolAddressesProviderAddress
  ) public {
    require(address(_comptroller) != address(0), "AavePrizePoolBuilder/comptroller-not-zero");
    require(address(_singleRandomWinnerBuilder) != address(0), "AavePrizePoolBuilder/single-random-winner-builder-not-zero");
    require(address(_aavePrizePoolProxyFactory) != address(0), "AavePrizePoolBuilder/aave-prize-pool-builder-not-zero");
    comptroller = _comptroller;
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
      prizeStrategy,
      comptroller,
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

    emit PrizePoolCreated(msg.sender, address(prizePool), address(prizeStrategy));

    return prizePool;
  }

  function createAavePrizePool(
    AavePrizePoolConfig calldata config,
    PrizePoolTokenListenerInterface prizeStrategy
  )
    external
    returns (AavePrizePool)
  {
    AavePrizePool prizePool = aavePrizePoolProxyFactory.create();

    address[] memory tokens;

    prizePool.initialize(
      trustedForwarder,
      prizeStrategy,
      comptroller,
      tokens,
      config.maxExitFeeMantissa,
      config.maxTimelockDuration,
      config.aToken,
      lendingPoolAddressesProviderAddress
    );

    prizePool.transferOwnership(msg.sender);

    emit PrizePoolCreated(msg.sender, address(prizePool), address(prizeStrategy));

    return prizePool;
  }
}
