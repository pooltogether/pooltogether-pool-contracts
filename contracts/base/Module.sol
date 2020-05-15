pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Implementer.sol";
import "@nomiclabs/buidler/console.sol";

import "../util/ERC1820Constants.sol";
import "./ModuleManager.sol";

abstract contract Module is Initializable, OwnableUpgradeSafe, IERC1820Implementer {

  ModuleManager public manager;

  modifier onlyManager() virtual {
    require(msg.sender == address(manager), "Method can only be called from manager");
    _;
  }

  modifier authorized() virtual {
    bool isModule = manager.isModuleEnabled(Module(msg.sender));
    console.log("authorized? manager: %s sender: %s, isModule: %s", address(manager), msg.sender, isModule);
    require(msg.sender == address(manager) || isModule, "Method can only be called from manager or module");
    _;
  }
  
  function construct () public initializer {
    __Ownable_init();
  }

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

  function setManager(ModuleManager _manager)
    external
    onlyOwner
  {
    // manager can only be 0 at initalization of contract.
    // Check ensures that setup function can only be called once.
    require(address(manager) == address(0), "Manager has already been set");
    require(address(_manager) != address(0), "Manager cannot be zero");
    manager = _manager;
  }
}