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

import "./MCDAwarePool.sol";
import "scd-mcd-migration/src/ScdMcdMigration.sol";

contract Pool is MCDAwarePool {
  function scdMcdMigration() public view returns (ScdMcdMigration) {
    return ScdMcdMigration(0xc73e0383F3Aff3215E6f04B0331D58CeCf0Ab849);
  }

  function saiPool() public view returns (MCDAwarePool) {
    return MCDAwarePool(0xb7896fce748396EcFC240F5a0d3Cc92ca42D7d84);
  }
}