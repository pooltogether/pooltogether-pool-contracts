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

import "@openzeppelin/contracts/contracts/token/ERC20/ERC20Mintable.sol";

/**
 * @author Brendan Asselstine
 * @notice An ERC20 Token contract to be used for testing the Pool contract
 */
contract Token is ERC20Mintable {
  string public constant name = "Token";
  string public constant symbol = "TOK";
  uint8 public constant decimals = 18;
}
