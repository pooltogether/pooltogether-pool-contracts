/**
Copyright 2019 PoolTogether LLC

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

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Mintable.sol";

/**
 * @author Brendan Asselstine
 * @notice An ERC20 Token contract to be used for testing the Pool contract
 */
contract Token is Initializable, ERC20Mintable {
  string public name = "Token";
  string public symbol = "TOK";
  uint256 public decimals;

  function initialize (string _name, string _symbol, uint256 _decimals) public initializer {
    if (bytes(_name).length == 0) {
      _name = "Token";
    }
    name = _name;

    if (bytes(_symbol).length == 0) {
      _symbol = "TOK";
    }
    symbol = _symbol;

    if (_decimals == uint256(0)) {
      _decimals = 18;
    }
    decimals = _decimals;
  }

}
