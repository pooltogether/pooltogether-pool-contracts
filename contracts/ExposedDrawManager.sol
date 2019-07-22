pragma solidity ^0.5.0;

import "./DrawManager.sol";

contract ExposedDrawManager {
    using DrawManager for DrawManager.DrawState;

    DrawManager.DrawState drawState;

    function openNextDraw() public {
      drawState.openNextDraw();
    }

    function deposit(address user, uint256 amount) public {
      drawState.deposit(user, amount);
    }

    function withdraw(address user, uint256 amount) public {
      drawState.withdraw(user, amount);
    }

    function balanceOf(address user) public view returns (uint256) {
      return drawState.balanceOf(user);
    }

    function eligibleBalanceOf(address user) public view returns (uint256) {
      return drawState.eligibleBalanceOf(user);
    }

    function openBalanceOf(address user) public view returns (uint256) {
      return drawState.openBalanceOf(user);
    }

    function eligibleSupply() public view returns (uint256) {
      return drawState.eligibleSupply;
    }

    function openSupply() public view returns (uint256) {
      return drawState.openSupply();
    }

    function currentDrawIndex() public view returns (uint256) {
      return drawState.currentDrawIndex;
    }

    /**
     * Draws a winner from the previous draws
     */
    function getDraw(uint256 index) public view returns (uint256) {
      return drawState.getDraw(index);
    }

    function draw(uint256 token) public view returns (address) {
      return drawState.draw(token);
    }

    function firstDrawIndex(address user) public view returns (uint256) {
        return drawState.usersFirstDrawIndex[user];
    }

    function secondDrawIndex(address user) public view returns (uint256) {
        return drawState.usersSecondDrawIndex[user];
    }

    function drawWithEntropy(uint256 entropy) public view returns (address) {
        return drawState.drawWithEntropy(entropy);
    }
}