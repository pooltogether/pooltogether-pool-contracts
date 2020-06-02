pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "../external/gnosis/ModuleManager.sol";
import "../Constants.sol";

contract ModuleManagerHarness is Initializable, ModuleManager {

  function initialize() public initializer {
    setupModules(address(0), "");
  }

  modifier authorized() override {
    _;
  }

  function exec(address to, uint256 value, bytes memory data, Enum.Operation operation) public {
    execute(to, value, data, operation, gasleft());
  }

  function register(bytes32 interfaceHash, address target) public {
    Constants.REGISTRY.setInterfaceImplementer(address(this), interfaceHash, target);
  }

}