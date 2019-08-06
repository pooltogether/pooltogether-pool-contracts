pragma solidity 0.5.10;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Mintable.sol";

/**
 * @author Brendan Asselstine
 * @notice An ERC20 Token contract to be used for testing the Pool contract
 */
contract Token is ERC20Mintable {
  string public constant name = "Token";
  string public constant symbol = "TOK";
  uint8 public constant decimals = 18;
}
