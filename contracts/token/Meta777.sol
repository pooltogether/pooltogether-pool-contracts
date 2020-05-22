pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/ERC777.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";

import "./TokenControllerInterface.sol";

contract Meta777 is Initializable, ReentrancyGuardUpgradeSafe, ERC777UpgradeSafe, BaseRelayRecipient {
  function initialize(
    string memory name,
    string memory symbol,
    address _trustedForwarder
  ) public virtual initializer {
    require(_trustedForwarder != address(0), "forwarder is not zero");
    __ReentrancyGuard_init();
    address[] memory defaultOperators;
    __ERC777_init(name, symbol, defaultOperators);
    trustedForwarder = _trustedForwarder;
  }

  function _msgSender() internal override(BaseRelayRecipient, ContextUpgradeSafe) virtual view returns (address payable) {
    return BaseRelayRecipient._msgSender();
  }
}