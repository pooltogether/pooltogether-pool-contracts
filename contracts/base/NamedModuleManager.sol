pragma solidity ^0.6.4;

import "../external/gnosis/ModuleManager.sol";
import "../Constants.sol";

contract NamedModuleManager is ModuleManager {
  function enableModuleInterface(bytes32 hashName) external {
    require(address(msg.sender) != address(0) && address(msg.sender) != SENTINEL_MODULES, "Invalid module address provided");
    Constants.REGISTRY.setInterfaceImplementer(address(this),hashName,msg.sender);
  }

  function requireModule(bytes32 interfaceHash) internal view returns (address) {
    address implementer = Constants.REGISTRY.getInterfaceImplementer(address(this), interfaceHash);
    require(implementer != address(0), "interface does not exist");
    return implementer;
  }
}