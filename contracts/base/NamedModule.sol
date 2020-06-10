pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Implementer.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
// import "@gnosis.pm/safe-contracts/contracts/base/Module.sol";

import "../external/gnosis/Module.sol";
import "./NamedModuleManager.sol";
import "../Constants.sol";

abstract contract NamedModule is Initializable, Module, IERC1820Implementer, BaseRelayRecipient {

  function construct (
    NamedModuleManager _manager,
    address _trustedForwarder
  ) public virtual initializer {
    setManager(_manager);
    _manager.enableModuleInterface(hashName());
    if (_trustedForwarder != address(0)) {
      trustedForwarder = _trustedForwarder;
    }
  }

  function hashName() public virtual view returns (bytes32);

  function canImplementInterfaceForAddress(bytes32 interfaceHash, address addr) external view virtual override returns(bytes32) {
    require(address(manager) != address(0), "manager is not set on module");
    if (addr == address(manager) && interfaceHash == hashName()) {
      return Constants.ACCEPT_MAGIC;
    } else {
      return bytes32(0);
    }
  }

  function _msgSender() internal override virtual view returns (address payable) {
    return BaseRelayRecipient._msgSender();
  }

  modifier onlyManagerOrModule() virtual {
      bool isModule = manager.isModuleEnabled(Module(msg.sender));
      require(isModule || msg.sender == address(manager), "Method can only be called from manager or module");
      _;
  }
}
