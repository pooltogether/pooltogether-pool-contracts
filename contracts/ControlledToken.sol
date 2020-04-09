pragma solidity ^0.6.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./IComptroller.sol";

contract ControlledToken is ERC20 {

  IComptroller public comptroller;
  string public name;
  string public symbol;

  constructor(
    string memory _name,
    string memory _symbol,
    IComptroller _comptroller
  ) public {
    require(address(_comptroller) != address(0), "comptroller cannot be zero");
    name = _name;
    symbol = _symbol;
    comptroller = _comptroller;
  }

  function _beforeTokenTransfer(address from, address to, uint256 tokenAmount) internal override {
    // comptroller.beforeTokenTransfer(from, to, tokenAmount);
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
    require(_msgSender() == address(comptroller), "only comptroller");
    _;
  }
}