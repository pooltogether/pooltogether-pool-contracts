pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/ERC777.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import "./TokenControllerInterface.sol";

// solium-disable security/no-block-members
contract ControlledToken is ERC777UpgradeSafe, BaseRelayRecipient {

  TokenControllerInterface controller;

  function initialize(
    string memory name,
    string memory symbol,
    address[] memory defaultOperators,
    address _trustedForwarder,
    TokenControllerInterface _controller
  ) public virtual initializer {
    trustedForwarder = _trustedForwarder;
    __ERC777_init(name, symbol, defaultOperators);
    controller = _controller;
  }

  function mint(address _user, uint256 _amount, bytes calldata data, bytes calldata operatorData) external virtual onlyController {
    _mint(_user, _amount, data, operatorData);
  }

  function burn(address _user, uint256 _amount, bytes calldata data, bytes calldata operatorData) external virtual onlyController {
    _burn(_user, _amount, data, operatorData);
  }

  modifier onlyController {
    require(_msgSender() == address(controller), "only controller");
    _;
  }

  function _beforeTokenTransfer(address operator, address from, address to, uint256 amount) internal virtual override {
    controller.beforeTokenTransfer(operator, from, to, amount);
  }

  function _msgSender() internal override(BaseRelayRecipient, ContextUpgradeSafe) virtual view returns (address payable) {
    return BaseRelayRecipient._msgSender();
  }
}
