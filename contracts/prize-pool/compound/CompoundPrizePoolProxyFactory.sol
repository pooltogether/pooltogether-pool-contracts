pragma solidity 0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./CompoundPrizePool.sol";
import "../../external/openzeppelin/ProxyFactory.sol";

/// @title Compound Prize Pool Factory
/// @notice Minimal proxy pattern for creating new Compound Prize Pools
contract CompoundPrizePoolProxyFactory is Initializable, ProxyFactory {

  /// @notice Contract template for deploying proxied Prize Pools
  CompoundPrizePool public instance;

  /// @notice Initializes the Factory with an instance of the Compound Prize Pool
  function initialize () public initializer {
    instance = new CompoundPrizePool();
  }

  /// @notice Creates a new Compound Prize Pool as a proxy of the template instance
  /// @return A reference to the new proxied Compound Prize Pool
  function create() external returns (CompoundPrizePool) {
    return CompoundPrizePool(deployMinimal(address(instance), ""));
  }
}
