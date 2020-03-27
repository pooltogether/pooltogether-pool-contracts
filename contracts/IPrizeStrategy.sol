pragma solidity ^0.6.4;

interface IPrizeStrategy {
    function updateBalanceOf(address user, uint256 amount) external;
}