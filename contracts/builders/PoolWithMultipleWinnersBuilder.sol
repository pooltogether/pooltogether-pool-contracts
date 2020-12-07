// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";

import "@nomiclabs/buidler/console.sol";

import "./CompoundPrizePoolBuilder.sol";
import "./VaultPrizePoolBuilder.sol";
import "./StakePrizePoolBuilder.sol";
import "./MultipleWinnersBuilder.sol";

contract PoolWithMultipleWinnersBuilder {
  using SafeCast for uint256;

  event CompoundPrizePoolWithMultipleWinnersCreated(address indexed prizePool, address indexed prizeStrategy);
  event StakePrizePoolWithMultipleWinnersCreated(address indexed prizePool, address indexed prizeStrategy);
  event VaultPrizePoolWithMultipleWinnersCreated(address indexed prizePool, address indexed prizeStrategy);

  CompoundPrizePoolBuilder public compoundPrizePoolBuilder;
  VaultPrizePoolBuilder public vaultPrizePoolBuilder;
  StakePrizePoolBuilder public stakePrizePoolBuilder;
  MultipleWinnersBuilder public multipleWinnersBuilder;

  constructor (
    CompoundPrizePoolBuilder _compoundPrizePoolBuilder,
    VaultPrizePoolBuilder _vaultPrizePoolBuilder,
    StakePrizePoolBuilder _stakePrizePoolBuilder,
    MultipleWinnersBuilder _multipleWinnersBuilder
  ) public {
    require(address(_compoundPrizePoolBuilder) != address(0), "GlobalBuilder/compoundPrizePoolBuilder-not-zero");
    require(address(_vaultPrizePoolBuilder) != address(0), "GlobalBuilder/vaultPrizePoolBuilder-not-zero");
    require(address(_stakePrizePoolBuilder) != address(0), "GlobalBuilder/stakePrizePoolBuilder-not-zero");
    require(address(_multipleWinnersBuilder) != address(0), "GlobalBuilder/multipleWinnersBuilder-not-zero");
    compoundPrizePoolBuilder = _compoundPrizePoolBuilder;
    vaultPrizePoolBuilder = _vaultPrizePoolBuilder;
    stakePrizePoolBuilder = _stakePrizePoolBuilder;
    multipleWinnersBuilder = _multipleWinnersBuilder;
  }

  function createCompoundMultipleWinners(
    CompoundPrizePoolBuilder.CompoundPrizePoolConfig memory prizePoolConfig,
    MultipleWinnersBuilder.MultipleWinnersConfig memory prizeStrategyConfig,
    uint8 decimals
  ) external returns (CompoundPrizePool) {
    CompoundPrizePool prizePool = compoundPrizePoolBuilder.createCompoundPrizePool(prizePoolConfig);
    MultipleWinners prizeStrategy = _createMultipleWinnersAndTransferPrizePool(prizePool, prizeStrategyConfig, decimals);
    emit CompoundPrizePoolWithMultipleWinnersCreated(address(prizePool), address(prizeStrategy));
    return prizePool;
  }

  function createStakeMultipleWinners(
    StakePrizePoolBuilder.StakePrizePoolConfig memory prizePoolConfig,
    MultipleWinnersBuilder.MultipleWinnersConfig memory prizeStrategyConfig,
    uint8 decimals
  ) external returns (StakePrizePool) {
    StakePrizePool prizePool = stakePrizePoolBuilder.createStakePrizePool(prizePoolConfig);
    MultipleWinners prizeStrategy = _createMultipleWinnersAndTransferPrizePool(prizePool, prizeStrategyConfig, decimals);
    emit StakePrizePoolWithMultipleWinnersCreated(address(prizePool), address(prizeStrategy));
    return prizePool;
  }

  function createVaultMultipleWinners(
    VaultPrizePoolBuilder.VaultPrizePoolConfig memory prizePoolConfig,
    MultipleWinnersBuilder.MultipleWinnersConfig memory prizeStrategyConfig,
    uint8 decimals
  ) external returns (yVaultPrizePool) {
    yVaultPrizePool prizePool = vaultPrizePoolBuilder.createVaultPrizePool(prizePoolConfig);
    MultipleWinners prizeStrategy = _createMultipleWinnersAndTransferPrizePool(prizePool, prizeStrategyConfig, decimals);
    emit VaultPrizePoolWithMultipleWinnersCreated(address(prizePool), address(prizeStrategy));
    return prizePool;
  }

  function _createMultipleWinnersAndTransferPrizePool(
    PrizePool prizePool,
    MultipleWinnersBuilder.MultipleWinnersConfig memory prizeStrategyConfig,
    uint8 decimals
  ) internal returns (MultipleWinners) {

    MultipleWinners periodicPrizeStrategy = multipleWinnersBuilder.createMultipleWinners(
      prizePool,
      prizeStrategyConfig,
      decimals,
      msg.sender
    );

    address ticket = address(periodicPrizeStrategy.ticket());

    prizePool.setPrizeStrategy(periodicPrizeStrategy);

    prizePool.addControlledToken(Ticket(ticket));
    prizePool.addControlledToken(ControlledTokenInterface(address(periodicPrizeStrategy.sponsorship())));

    prizePool.setCreditPlanOf(
      ticket,
      prizeStrategyConfig.ticketCreditRateMantissa.toUint128(),
      prizeStrategyConfig.ticketCreditLimitMantissa.toUint128()
    );

    prizePool.transferOwnership(msg.sender);

    return periodicPrizeStrategy;
  }
}
