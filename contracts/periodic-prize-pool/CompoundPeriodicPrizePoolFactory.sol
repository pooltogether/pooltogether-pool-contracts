pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./CompoundPeriodicPrizePool.sol";
import "../external/openzeppelin/ProxyFactory.sol";

contract CompoundPeriodicPrizePoolFactory is Initializable, ProxyFactory {

  PeriodicPrizePool public instance;

  function initialize () public initializer {
    instance = new CompoundPeriodicPrizePool();
  }

  function createCompoundPeriodicPrizePool() external returns (CompoundPeriodicPrizePool) {
    return CompoundPeriodicPrizePool(deployMinimal(address(instance), ""));
  }
}
