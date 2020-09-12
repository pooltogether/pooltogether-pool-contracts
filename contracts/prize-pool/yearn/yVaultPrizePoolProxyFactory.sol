pragma solidity 0.6.4;

import "./yVaultPrizePool.sol";
import "../../external/openzeppelin/ProxyFactory.sol";

/// @title Compound Prize Pool Proxy Factory
/// @notice Minimal proxy pattern for creating new Compound Prize Pools
contract yVaultPrizePoolProxyFactory is ProxyFactory {

  /// @notice Contract template for deploying proxied Prize Pools
  yVaultPrizePool public instance;

  /// @notice Initializes the Factory with an instance of the Compound Prize Pool
  constructor () public {
    instance = new yVaultPrizePool();
  }

  /// @notice Creates a new Compound Prize Pool as a proxy of the template instance
  /// @return A reference to the new proxied Compound Prize Pool
  function create() external returns (yVaultPrizePool) {
    return yVaultPrizePool(deployMinimal(address(instance), ""));
  }
}
