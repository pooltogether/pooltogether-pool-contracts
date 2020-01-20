pragma solidity 0.5.12;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/ERC777.sol";

/**
 * @dev Extension of {ERC20} that adds a set of accounts with the {MinterRole},
 * which have permission to mint (create) new tokens as they see fit.
 *
 * At construction, the deployer of the contract is the only minter.
 */
contract ERC777Mintable is ERC777 {
    /**
     * @dev See {ERC20-_mint}.
     *
     * Requirements:
     *
     * - the caller must have the {MinterRole}.
     */
    function mint(address account, uint256 amount, bytes memory userData) public returns (bool) {
        _mint(msg.sender, account, amount, userData, "");
        return true;
    }
}
