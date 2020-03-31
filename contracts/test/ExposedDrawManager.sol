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

import "../DrawManager.sol";

contract ExposedDrawManager {
    using DrawManager for DrawManager.State;

    DrawManager.State state;

    function openNextDraw() public {
      state.openNextDraw();
    }

    function deposit(address user, uint256 amount) public {
      state.deposit(user, amount);
    }

    function depositCommitted(address _addr, uint256 _amount) public {
      state.depositCommitted(_addr, _amount);
    }

    function withdraw(address user) public {
      state.withdraw(user);
    }

    function withdrawOpen(address user, uint256 amount) public {
      state.withdrawOpen(user, amount);
    }

    function withdrawCommitted(address user, uint256 amount) public {
      state.withdrawCommitted(user, amount);
    }

    function balanceOf(address user) public view returns (uint256) {
      return state.balanceOf(user);
    }

    function committedBalanceOf(address user) public view returns (uint256) {
      return state.committedBalanceOf(user);
    }

    function openBalanceOf(address user) public view returns (uint256) {
      return state.openBalanceOf(user);
    }

    function committedSupply() public view returns (uint256) {
      return state.committedSupply();
    }

    function openSupply() public view returns (uint256) {
      return state.openSupply();
    }

    function openDrawIndex() public view returns (uint256) {
      return state.openDrawIndex;
    }

    function draw(uint256 token) public view returns (address) {
      return state.draw(token);
    }

    function consolidatedDrawIndex(address user) public view returns (uint256) {
        return state.consolidatedDrawIndices[user];
    }

    function latestDrawIndex(address user) public view returns (uint256) {
        return state.latestDrawIndices[user];
    }

    function drawWithEntropy(bytes32 entropy) public view returns (address) {
        return state.drawWithEntropy(entropy);
    }
}