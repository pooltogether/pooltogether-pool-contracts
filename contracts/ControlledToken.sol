pragma solidity ^0.6.4;

import "@openzeppelin/contracts/token/ERC777/ERC777.sol";

import "./IComptroller.sol";

contract ControlledToken is ERC777 {

  IComptroller public comptroller;

  constructor(
    IComptroller _comptroller,
    string memory name,
    string memory symbol,
    address[] memory defaultOperators
  ) public ERC777(name, symbol, defaultOperators) {
    require(address(_comptroller) != address(0), "comptroller cannot be zero");
    comptroller = _comptroller;
  }

  function _beforeTokenTransfer(address operator, address from, address to, uint256 tokenAmount) internal override {
    comptroller.beforeTransfer(operator, from, to, tokenAmount);
  }

  function mint(
    address account,
    uint256 amount,
    bytes calldata userData,
    bytes calldata operatorData
  ) external onlyComptroller {
    _mint(account, amount, userData, operatorData);
  }

  function burn(
    address from,
    uint256 amount,
    bytes calldata data,
    bytes calldata operatorData
  ) external onlyComptroller {
    _burn(from, amount, data, operatorData);
  }

  modifier onlyComptroller() {
    require(_msgSender() == address(comptroller), "only comptroller");
    _;
  }
}