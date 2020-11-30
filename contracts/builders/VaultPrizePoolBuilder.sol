// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "../registry/RegistryInterface.sol";
import "./PrizePoolBuilder.sol";
import "../prize-pool/yearn/yVaultPrizePoolProxyFactory.sol";
import "../external/yearn/yVaultInterface.sol";
import "../external/openzeppelin/OpenZeppelinProxyFactoryInterface.sol";

/* solium-disable security/no-block-members */
contract VaultPrizePoolBuilder is PrizePoolBuilder {
  using SafeMath for uint256;
  using SafeCast for uint256;

  struct VaultPrizePoolConfig {
    yVaultInterface vault;
    uint256 reserveRateMantissa;
    uint256 maxExitFeeMantissa;
    uint256 maxTimelockDuration;
    bool useGSN;
  }

  RegistryInterface public reserveRegistry;
  yVaultPrizePoolProxyFactory public vaultPrizePoolProxyFactory;
  address public trustedForwarder;

  constructor (
    RegistryInterface _reserveRegistry,
    address _trustedForwarder,
    yVaultPrizePoolProxyFactory _vaultPrizePoolProxyFactory
  ) public {
    require(address(_reserveRegistry) != address(0), "VaultPrizePoolBuilder/reserveRegistry-not-zero");
    require(address(_vaultPrizePoolProxyFactory) != address(0), "VaultPrizePoolBuilder/compound-prize-pool-builder-not-zero");
    reserveRegistry = _reserveRegistry;
    trustedForwarder = _trustedForwarder;
    vaultPrizePoolProxyFactory = _vaultPrizePoolProxyFactory;
  }

  function createVaultPrizePool(
    VaultPrizePoolConfig calldata config
  )
    external
    returns (yVaultPrizePool)
  {
    yVaultPrizePool prizePool = vaultPrizePoolProxyFactory.create();

    address[] memory tokens;

    prizePool.initialize(
      config.useGSN ? trustedForwarder : address(0),
      reserveRegistry,
      tokens,
      config.maxExitFeeMantissa,
      config.maxTimelockDuration,
      config.vault,
      config.reserveRateMantissa
    );

    prizePool.transferOwnership(msg.sender);

    emit PrizePoolCreated(msg.sender, address(prizePool));

    return prizePool;
  }
}
