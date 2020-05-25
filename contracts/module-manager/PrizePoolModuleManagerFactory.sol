pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./PrizePoolModuleManager.sol";
import "../external/openzeppelin/ProxyFactory.sol";

contract PrizePoolModuleManagerFactory is Initializable, ProxyFactory {

  PrizePoolModuleManager public instance;

  function initialize () public initializer {
    instance = new PrizePoolModuleManager();
  }

  function createPrizePoolModuleManager() external returns (PrizePoolModuleManager) {
    return PrizePoolModuleManager(deployMinimal(address(instance), ""));
  }
}