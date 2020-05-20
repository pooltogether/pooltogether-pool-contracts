pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./CompoundYieldService.sol";
import "../token/ControlledToken.sol";
import "../external/openzeppelin/ProxyFactory.sol";

contract CompoundYieldServiceFactory is Initializable, ProxyFactory {

  CompoundYieldService public instance;

  function initialize () public initializer {
    instance = new CompoundYieldService();
  }

  function createCompoundYieldService() external returns (CompoundYieldService) {
    return CompoundYieldService(deployMinimal(address(instance), ""));
  }
}