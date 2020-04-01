/**
Copyright 2020 PoolTogether Inc.

This file is part of PoolTogether.

PoolTogether is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation under version 3 of the License.

PoolTogether is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with PoolTogether.  If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity 0.5.12;

import "./PoolToken.sol";

/**
 * @dev Implementation of the {IERC777} interface.
 *
 * Largely taken from the OpenZeppelin ERC777 contract.
 *
 * Support for ERC20 is included in this contract, as specified by the EIP: both
 * the ERC777 and ERC20 interfaces can be safely used when interacting with it.
 * Both {IERC777-Sent} and {IERC20-Transfer} events are emitted on token
 * movements.
 *
 * Additionally, the {IERC777-granularity} value is hard-coded to `1`, meaning that there
 * are no special restrictions in the amount of tokens that created, moved, or
 * destroyed. This makes integration with ERC20 applications seamless.
 *
 * It is important to note that no Mint events are emitted.  Tokens are minted in batches
 * by a state change in a tree data structure, so emitting a Mint event for each user
 * is not possible.
 *
 */
contract PoolTokenDecimals is PoolToken {

  // Need to support different decimals depending on the Pool's underlying token.
  // This is a deviation from the ERC777 spec: https://eips.ethereum.org/EIPS/eip-777#backward-compatibility
  uint8 internal _decimals;

  /**
   * @notice Initializes the PoolToken.
   * @param name The name of the token
   * @param symbol The token symbol
   * @param defaultOperators The default operators who are allowed to move tokens
   * @param pool The pool to bind to
   */
  function init (
    string memory name,
    string memory symbol,
    address[] memory defaultOperators,
    BasePool pool
  ) public initializer {
      initPoolToken(name, symbol, defaultOperators, pool, 18);
  }

  /**
   * @notice Initializes the PoolToken.
   * @param name The name of the token
   * @param symbol The token symbol
   * @param defaultOperators The default operators who are allowed to move tokens
   * @param pool The pool to bind to
   * @param decimals The number of decimals the Pool's token uses.
   */
  function init (
    string memory name,
    string memory symbol,
    address[] memory defaultOperators,
    BasePool pool,
    uint8 decimals
  ) public initializer {
      initPoolToken(name, symbol, defaultOperators, pool, decimals);
  }

  function initPoolToken (
    string memory name,
    string memory symbol,
    address[] memory defaultOperators,
    BasePool pool,
    uint8 decimals
  ) internal {
      super.init(name, symbol, defaultOperators, pool);
      require(decimals > 0, "PoolToken/decimals-zero");

      _decimals = decimals;
  }

  /**
    * @dev See {ERC20Detailed-decimals}.
    *
    * Returns the number of decimal places this token should have.  This deviates from the ERC777 spec
    * because deposits into the Pool may use alternative decimal places (such as USDC)
    * [ERC777 EIP](https://eips.ethereum.org/EIPS/eip-777#backward-compatibility).
    */
  function decimals() public view returns (uint8) {
      return _decimals;
  }
}
