pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Implementer.sol";

import "./Module.sol";
import "../util/ERC1820Constants.sol";

abstract contract NamedModule is Module, IERC1820Implementer {

  function hashName() public virtual view returns (bytes32);

  function canImplementInterfaceForAddress(bytes32 interfaceHash, address addr) external view virtual override returns(bytes32) {
    // console.log("CAN IMPLEMMENT?");
    require(address(manager) != address(0), "manager is not set on module");
    if (addr == address(manager) && interfaceHash == hashName()) {
      // console.log("YES CAN IMPLEMMENT");
      return ERC1820Constants.ACCEPT_MAGIC;
    } else {
      // console.log("no CAN IMPLEMMENT");
      return bytes32(0);
    }
  }

  function getInterfaceImplementer(bytes32 name) internal virtual view returns (address) {
    address result = ERC1820Constants.REGISTRY.getInterfaceImplementer(address(manager), name);
    require(result != address(0), "no implementation registered");
    return result;
  }

  function enableInterface() internal virtual onlyWhenEnabled {
    setInterfaceImplementer(hashName(), address(this));
  }

  function disableInterface() internal virtual onlyWhenEnabled {
    setInterfaceImplementer(hashName(), address(0));
  }

  function setInterfaceImplementer(bytes32 interfaceHash, address target) internal virtual {
    bytes memory data = abi.encodeWithSignature(
      "setInterfaceImplementer(address,bytes32,address)", address(manager), interfaceHash, target
    );
    require(
      manager.execTransactionFromModule(address(ERC1820Constants.REGISTRY), 0, data, Enum.Operation.Call),
      "could not set interface"
    );
  }

  modifier onlyWhenEnabled() virtual {
    require(manager.isModuleEnabled(this), "module is not enabled");
    _;
  }
}
