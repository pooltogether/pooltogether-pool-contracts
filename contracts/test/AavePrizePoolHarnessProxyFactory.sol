pragma solidity >=0.6.0 <0.7.0;

import "./AavePrizePoolHarness.sol";
import "../external/openzeppelin/ProxyFactory.sol";

/// @title Aave Prize Pool Proxy Factory
/// @notice Minimal proxy pattern for creating new Aave Prize Pools
contract AavePrizePoolHarnessProxyFactory is ProxyFactory {

  /// @notice Contract template for deploying proxied Prize Pools
  AavePrizePoolHarness public instance;

  /// @notice Initializes the Factory with an instance of the Aave Prize Pool
  constructor () public {
    instance = new AavePrizePoolHarness();
  }

  /// @notice Creates a new Aave Prize Pool as a proxy of the template instance
  /// @return A reference to the new proxied Aave Prize Pool
  function create() external returns (AavePrizePoolHarness) {
    return AavePrizePoolHarness(deployMinimal(address(instance), ""));
  }
}
