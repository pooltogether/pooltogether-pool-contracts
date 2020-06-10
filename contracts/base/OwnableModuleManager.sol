pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";

import "./NamedModuleManager.sol";

contract OwnableModuleManager is NamedModuleManager, OwnableUpgradeSafe, BaseRelayRecipient {

  function initialize(address _trustedForwarder) public initializer {
    __Ownable_init();
    setupModules(address(0), "");
    trustedForwarder = _trustedForwarder;
  }

  function _msgSender() internal override(BaseRelayRecipient, ContextUpgradeSafe) virtual view returns (address payable) {
    return BaseRelayRecipient._msgSender();
  }

  modifier authorized() override {
    require(msg.sender == address(this) || msg.sender == owner(), "only self or owner");
    _;
  }
}