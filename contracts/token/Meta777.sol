pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";

import "../external/openzeppelin/ReentrancyGuard.sol";
import "../external/openzeppelin/ERC777.sol";
import "../util/ERC1820Helper.sol";
import "./TokenControllerInterface.sol";

contract Meta777 is Initializable, ReentrancyGuard, ERC777, BaseRelayRecipient, ERC1820Helper {
  function initialize(
    string memory name,
    string memory symbol,
    address _trustedForwarder
  ) public initializer {
    require(_trustedForwarder != address(0), "forwarder is not zero");
    ReentrancyGuard.initialize();
    address[] memory defaultOperators;
    super.initialize(name, symbol, defaultOperators);
    trustedForwarder = _trustedForwarder;
  }

  function _mint(address user, uint256 amount) internal virtual {
    super._mint(user, amount, "", "");
  }

  function _burn(address user, uint256 amount) internal virtual {
    super._burn(user, amount, "", "");
  }

  function _msgSender() internal override(BaseRelayRecipient, Context) virtual view returns (address payable) {
    return BaseRelayRecipient._msgSender();
  }
}