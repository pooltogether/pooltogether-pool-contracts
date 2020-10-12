// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "./aavePrizePool.sol";
import "../../external/openzeppelin/ProxyFactory.sol";

/// @title aave Prize Pool Proxy Factory
/// @notice Minimal proxy pattern for creating new aave Prize Pools
contract AavePrizePoolProxyFactory is ProxyFactory {

  /// @notice Contract template for deploying proxied Prize Pools
  AavePrizePool public instance;

  /// @notice Initializes the Factory with an instance of the aave Prize Pool
  constructor () public {
    instance = new AavePrizePool();
  }

  /// @notice Creates a new aave Prize Pool as a proxy of the template instance
  /// @return A reference to the new proxied aave Prize Pool
  function create() external returns (AavePrizePool) {
    return AavePrizePool(deployMinimal(address(instance), ""));
  }
}
