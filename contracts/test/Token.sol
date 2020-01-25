pragma solidity ^0.5.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/roles/MinterRole.sol";

/**
 * @dev Extension of {ERC20} that adds a set of accounts with the {MinterRole},
 * which have permission to mint (create) new tokens as they see fit.
 *
 * At construction, the deployer of the contract is the only minter.
 */
contract Token is Initializable, ERC20, MinterRole {
  string public name;
  string public symbol;
  uint256 public decimals;

  function initialize(address sender, string memory _name, string memory _symbol, uint256 _decimals) public initializer {
      require(sender != address(0), "Pool/owner-zero");
      MinterRole.initialize(sender);

      name = _name;
      symbol = _symbol;
      decimals = _decimals;
  }

  /**
    * @dev See {ERC20-_mint}.
    *
    * Requirements:
    *
    * - the caller must have the {MinterRole}.
    */
  function mint(address account, uint256 amount) public onlyMinter returns (bool) {
      _mint(account, amount);
      return true;
  }

  uint256[50] private ______gap;
}
