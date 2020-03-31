pragma solidity ^0.6.4;

import "../IPrizeStrategy.sol";
import "../PrizePool.sol";

contract MockPrizeStrategy is IPrizeStrategy {

    mapping(address => uint256) public lastAfterBalanceChanged;

    PrizePool public prizePool;

    constructor (PrizePool _prizePool) public {
        prizePool = _prizePool;
    }

    function award() external {
        prizePool.awardPrize();
    }

    function afterBalanceChanged(address user, uint256 amount) external override {
        lastAfterBalanceChanged[user] = amount;
    }
}