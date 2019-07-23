pragma solidity ^0.5.0;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Mintable.sol";

contract Token is ERC20Mintable {
  string public constant name = "Token";
  string public constant symbol = "TOK";
  uint8 public constant decimals = 18;
}
