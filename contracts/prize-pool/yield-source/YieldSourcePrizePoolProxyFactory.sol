// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;

import "./YieldSourcePrizePool.sol";
import "../../external/openzeppelin/ProxyFactory.sol";

/// @title Yield Source Prize Pool Proxy Factory
/// @notice Minimal proxy pattern for creating new Yield Source Prize Pools
contract YieldSourcePrizePoolProxyFactory is ProxyFactory {

  /// @notice Contract template for deploying proxied Prize Pools
  YieldSourcePrizePool public instance;

  /// @notice Initializes the Factory with an instance of the Yield Source Prize Pool
  constructor () public {
    instance = new YieldSourcePrizePool();
  }

  /// @notice Creates a new Yield Source Prize Pool as a proxy of the template instance
  /// @return A reference to the new proxied Yield Source Prize Pool
  function create() external returns (YieldSourcePrizePool) {
    return YieldSourcePrizePool(deployMinimal(address(instance), ""));
  }
}
