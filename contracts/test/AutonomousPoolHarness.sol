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

import "../AutonomousPool.sol";

contract AutonomousPoolHarness is AutonomousPool {

  uint256 public timestamp;

  function setCurrentTime(uint256 _timestamp) external {
    timestamp = _timestamp;
  }

  function currentTime() internal view returns (uint256) {
    return timestamp;
  }
}
