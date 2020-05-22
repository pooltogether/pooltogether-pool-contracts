pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./PeriodicPrizePool.sol";
import "../yield-service/YieldServiceInterface.sol";
import "../external/openzeppelin/ProxyFactory.sol";

contract PeriodicPrizePoolFactory is Initializable, ProxyFactory {

  PeriodicPrizePool public instance;

  function initialize () public initializer {
    instance = new PeriodicPrizePool();
  }

  function createPeriodicPrizePool() external returns (PeriodicPrizePool) {
    return PeriodicPrizePool(deployMinimal(address(instance), ""));
  }
}
