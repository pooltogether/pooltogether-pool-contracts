pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./OwnableModuleManager.sol";
import "../external/openzeppelin/ProxyFactory.sol";

contract OwnableModuleManagerFactory is Initializable, ProxyFactory {

  OwnableModuleManager public instance;

  function initialize () public initializer {
    instance = new OwnableModuleManager();
  }

  function createOwnableModuleManager() external returns (OwnableModuleManager) {
    return OwnableModuleManager(deployMinimal(address(instance), ""));
  }
}