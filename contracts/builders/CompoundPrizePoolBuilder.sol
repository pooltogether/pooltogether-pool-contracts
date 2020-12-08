
// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "./PrizePoolBuilder.sol";
import "../registry/RegistryInterface.sol";
import "../prize-pool/compound/CompoundPrizePoolProxyFactory.sol";
import "../external/compound/CTokenInterface.sol";

/// @title Creates new Compound Prize Pools
/* solium-disable security/no-block-members */
contract CompoundPrizePoolBuilder is PrizePoolBuilder {
  using SafeMathUpgradeable for uint256;
  using SafeCastUpgradeable for uint256;

  /// @notice The configuration used to initialize the Compound Prize Pool
  struct CompoundPrizePoolConfig {
    CTokenInterface cToken;
    uint256 maxExitFeeMantissa;
    uint256 maxTimelockDuration;
    bool useGSN;
  }

  RegistryInterface public reserveRegistry;
  CompoundPrizePoolProxyFactory public compoundPrizePoolProxyFactory;
  address public trustedForwarder;

  constructor (
    RegistryInterface _reserveRegistry,
    address _trustedForwarder,
    CompoundPrizePoolProxyFactory _compoundPrizePoolProxyFactory
  ) public {
    require(address(_reserveRegistry) != address(0), "CompoundPrizePoolBuilder/reserveRegistry-not-zero");
    require(address(_compoundPrizePoolProxyFactory) != address(0), "CompoundPrizePoolBuilder/compound-prize-pool-builder-not-zero");
    reserveRegistry = _reserveRegistry;
    trustedForwarder = _trustedForwarder;
    compoundPrizePoolProxyFactory = _compoundPrizePoolProxyFactory;
  }

  /// @notice Creates a new Compound Prize Pool with a preconfigured prize strategy.
  /// @param config The config to use to initialize the Compound Prize Pool
  /// @return The Compound Prize Pool
  function createCompoundPrizePool(
    CompoundPrizePoolConfig calldata config
  )
    external
    returns (CompoundPrizePool)
  {
    CompoundPrizePool prizePool = compoundPrizePoolProxyFactory.create();

    ControlledTokenInterface[] memory tokens;

    prizePool.initialize(
      config.useGSN ? trustedForwarder : address(0),
      reserveRegistry,
      tokens,
      config.maxExitFeeMantissa,
      config.maxTimelockDuration,
      config.cToken
    );

    prizePool.transferOwnership(msg.sender);

    emit PrizePoolCreated(msg.sender, address(prizePool));

    return prizePool;
  }
}
