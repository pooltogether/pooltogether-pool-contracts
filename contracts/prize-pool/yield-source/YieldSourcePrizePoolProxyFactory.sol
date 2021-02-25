// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "./YieldSourcePrizePool.sol";
import "../../external/openzeppelin/ProxyFactory.sol";

/// @title yVault Prize Pool Proxy Factory
/// @notice Minimal proxy pattern for creating new yVault Prize Pools
contract YieldSourcePrizePoolProxyFactory is ProxyFactory {

  /// @notice Contract template for deploying proxied Prize Pools
  YieldSourcePrizePool public instance;

  /// @notice Initializes the Factory with an instance of the yVault Prize Pool
  constructor () public {
    instance = new YieldSourcePrizePool();
  }

  /// @notice Creates a new yVault Prize Pool as a proxy of the template instance
  /// @return A reference to the new proxied yVault Prize Pool
  function create() external returns (YieldSourcePrizePool) {
    return YieldSourcePrizePool(deployMinimal(address(instance), ""));
  }
}
