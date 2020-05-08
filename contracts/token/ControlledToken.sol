pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";

import "../external/openzeppelin/ERC20.sol";

import "./TokenControllerInterface.sol";

contract ControlledToken is BaseRelayRecipient, ERC20 {

  TokenControllerInterface public controller;

  function initialize (
    string memory _name,
    string memory _symbol,
    TokenControllerInterface _controller,
    address _trustedForwarder
  ) public virtual initializer {
    super.initialize(_name, _symbol);
    initialize(_controller, _trustedForwarder);
  }

  function initialize (
    TokenControllerInterface _controller,
    address _trustedForwarder
  ) public virtual initializer {
    require(address(_controller) != address(0), "controller cannot be zero");
    require(_trustedForwarder != address(0), "forwarder is not zero");
    controller = _controller;
    trustedForwarder = _trustedForwarder;
  }

  function _beforeTokenTransfer(address from, address to, uint256 tokenAmount) internal virtual override {
    controller.beforeTokenTransfer(from, to, tokenAmount);
  }

  function mint(
    address account,
    uint256 amount
  ) external virtual onlyController {
    _mint(account, amount);
  }

  function burn(
    address from,
    uint256 amount
  ) external virtual onlyController {
    _burn(from, amount);
  }

  function _msgSender() internal override(BaseRelayRecipient, Context) virtual view returns (address payable) {
    return BaseRelayRecipient._msgSender();
  }

  modifier onlyController() {
    require(_msgSender() == address(controller), "only controller");
    _;
  }
}