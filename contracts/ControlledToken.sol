pragma solidity ^0.6.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./ITokenController.sol";

contract ControlledToken is ERC20 {

  ITokenController public controller;
  string public name;
  string public symbol;

  constructor(
    string memory _name,
    string memory _symbol,
    ITokenController _controller
  ) public {
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