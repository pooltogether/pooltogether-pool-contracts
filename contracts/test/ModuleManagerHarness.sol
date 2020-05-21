pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "../base/ModuleManager.sol";

contract ModuleManagerHarness is Initializable, ModuleManager {

  function initialize() public initializer {
    setupModules(address(0), "");
  }

  modifier authorized() override {
    _;
  }

}