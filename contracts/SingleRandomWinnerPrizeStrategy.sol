pragma solidity ^0.6.4;

import "@kleros/kleros/contracts/data-structures/SortitionSumTreeFactory.sol";
import "@pooltogether/uniform-random-number/contracts/UniformRandomNumber.sol";

import "./IPrizeStrategy.sol";

contract SingleRandomWinnerPrizeStrategy is IPrizeStrategy {
    using SortitionSumTreeFactory for SortitionSumTreeFactory.SortitionSumTrees;

    SortitionSumTreeFactory.SortitionSumTrees sortitionSumTrees;

    bytes32 constant private TREE_KEY = keccak256("PoolTogether/SingleRandomWinnerPrizeStrategy");
    uint256 constant private MAX_TREE_LEAVES = 5;

    constructor () public {
        sortitionSumTrees.createTree(TREE_KEY, MAX_TREE_LEAVES);
    }

    function updateBalanceOf(address user, uint256 amount) external override {
        sortitionSumTrees.set(TREE_KEY, amount, bytes32(user));
    }
}