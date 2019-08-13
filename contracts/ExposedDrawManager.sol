pragma solidity 0.5.10;

import "./DrawManager.sol";

contract ExposedDrawManager {
    using DrawManager for DrawManager.State;

    DrawManager.State state;

    function openNextDraw() public {
      state.openNextDraw();
    }

    function deposit(address user, uint256 amount) public {
      state.deposit(user, amount);
    }

    function withdraw(address user) public {
      state.withdraw(user);
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
      return state.committedSupply;
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

    function firstDrawIndex(address user) public view returns (uint256) {
        return state.usersFirstDrawIndex[user];
    }

    function secondDrawIndex(address user) public view returns (uint256) {
        return state.usersSecondDrawIndex[user];
    }

    function drawWithEntropy(bytes32 entropy) public view returns (address) {
        return state.drawWithEntropy(entropy);
    }
}