pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";

import "./TokenControllerInterface.sol";

// solium-disable security/no-block-members
contract ControlledToken is ERC20UpgradeSafe, BaseRelayRecipient {

  TokenControllerInterface public controller;

  function initialize(
    string memory _name,
    string memory _symbol,
    address _trustedForwarder,
    TokenControllerInterface _controller
  ) public virtual initializer {
    trustedForwarder = _trustedForwarder;
    __ERC20_init(_name, _symbol);
    controller = _controller;
  }

  function controllerMint(address _user, uint256 _amount) external virtual onlyController {
    _mint(_user, _amount);
  }

  function controllerBurn(address _user, uint256 _amount) external virtual onlyController {
    _burn(_user, _amount);
  }

  function controllerBurnFrom(address _operator, address _user, uint256 _amount) external virtual onlyController {
    if (_operator != _user) {
      uint256 decreasedAllowance = allowance(_user, _operator).sub(_amount, "ControlledToken/exceeds-allowance");
      _approve(_user, _operator, decreasedAllowance);
    }
    _burn(_user, _amount);
  }

  modifier onlyController {
    require(_msgSender() == address(controller), "ControlledToken/only-controller");
    _;
  }

  function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
    controller.beforeTokenTransfer(from, to, amount);
  }

  function _msgSender() internal override(BaseRelayRecipient, ContextUpgradeSafe) virtual view returns (address payable) {
    return BaseRelayRecipient._msgSender();
  }
}
