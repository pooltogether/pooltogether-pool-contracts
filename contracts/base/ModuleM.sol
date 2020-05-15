pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Implementer.sol";

import "../util/ERC1820Constants.sol";
import "./ModuleManager.sol";

abstract contract ModuleM is Initializable, OwnableUpgradeSafe, IERC1820Implementer {

  ModuleManager public manager;

  modifier authorized() {
    require(msg.sender == address(manager), "Method can only be called from manager");
    _;
  }
  
  function construct () public initializer {
    __Ownable_init();
  }

  function hashName() public virtual view returns (bytes32);

  function canImplementInterfaceForAddress(bytes32 interfaceHash, address addr) external view override returns(bytes32) {
    if (addr == address(manager) && interfaceHash == hashName()) {
      return ERC1820Constants.ACCEPT_MAGIC;
    } else {
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