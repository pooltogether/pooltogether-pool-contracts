pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "./openzeppelin/ERC20.sol";

import "./TokenControllerInterface.sol";

contract ControlledToken is ERC20 {

  TokenControllerInterface public controller;

  function initialize (
    string memory _name,
    string memory _symbol,
    TokenControllerInterface _controller
  ) public virtual initializer {
    super.initialize(_name, _symbol);
    initialize(_controller);
  }

  function initialize (
    TokenControllerInterface _controller
  ) public virtual initializer {
    require(address(_controller) != address(0), "controller cannot be zero");
    controller = _controller;
  }

  function _beforeTokenTransfer(address from, address to, uint256 tokenAmount) internal virtual override {
    controller.beforeTokenTransfer(from, to, tokenAmount);
  }

  function mint(
    address account,
    uint256 amount
  ) external onlyController {
    _mint(account, amount);
  }

  function burn(
    address from,
    uint256 amount
  ) external onlyController {
    _burn(from, amount);
  }

  modifier onlyController() {
    require(_msgSender() == address(controller), "only controller");
    _;
  }
}