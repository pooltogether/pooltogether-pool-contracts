pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/ERC777.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";

import "../base/NamedModule.sol";

abstract contract TokenModule is Initializable, ERC777UpgradeSafe, NamedModule {

  function initialize(
    NamedModuleManager _manager,
    address _trustedForwarder,
    string memory name,
    string memory symbol
  ) public virtual initializer {
    address[] memory defaultOperators;
    initialize(_manager, _trustedForwarder, name, symbol, defaultOperators);
  }

  function initialize(
    NamedModuleManager _manager,
    address _trustedForwarder,
    string memory name,
    string memory symbol,
    address[] memory defaultOperators
  ) public virtual initializer {
    NamedModule.construct(_manager, _trustedForwarder);
    __ERC777_init(name, symbol, defaultOperators);
  }

  function _msgSender() internal override(ContextUpgradeSafe, NamedModule) virtual view returns (address payable) {
    return BaseRelayRecipient._msgSender();
  }
}
