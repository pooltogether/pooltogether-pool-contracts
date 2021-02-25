pragma solidity >=0.6.0 <0.7.0;

import "./YieldSourcePrizePoolHarness.sol";
import "../external/openzeppelin/ProxyFactory.sol";

/// @title YieldSource Prize Pool Proxy Factory
/// @notice Minimal proxy pattern for creating new YieldSource Prize Pools
contract YieldSourcePrizePoolHarnessProxyFactory is ProxyFactory {

  /// @notice Contract template for deploying proxied Prize Pools
  YieldSourcePrizePoolHarness public instance;

  /// @notice Initializes the Factory with an instance of the YieldSource Prize Pool
  constructor () public {
    instance = new YieldSourcePrizePoolHarness();
  }

  /// @notice Creates a new YieldSource Prize Pool as a proxy of the template instance
  /// @return A reference to the new proxied YieldSource Prize Pool
  function create() external returns (YieldSourcePrizePoolHarness) {
    return YieldSourcePrizePoolHarness(deployMinimal(address(instance), ""));
  }
}
