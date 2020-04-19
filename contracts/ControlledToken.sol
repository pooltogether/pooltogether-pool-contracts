pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./TokenControllerInterface.sol";

contract ControlledToken is Initializable, ERC20 {

  TokenControllerInterface public controller;
  string public name;
  string public symbol;

  function initialize (
    string memory _name,
    string memory _symbol,
    TokenControllerInterface _controller
  ) public virtual initializer {
    require(address(_controller) != address(0), "controller cannot be zero");
    name = _name;
    symbol = _symbol;
    controller = _controller;
  }

  function _beforeTokenTransfer(address from, address to, uint256 tokenAmount) internal virtual override {
    controller.beforeTokenTransfer(from, to, tokenAmount);
  }

  function mint(
    address account,
    uint256 amount
  ) external onlyComptroller {
    _mint(account, amount);
  }

  function burn(
    address from,
    uint256 amount
  ) external onlyComptroller {
    _burn(from, amount);
  }

  modifier onlyComptroller() {
    require(_msgSender() == address(controller), "only controller");
    _;
  }
}