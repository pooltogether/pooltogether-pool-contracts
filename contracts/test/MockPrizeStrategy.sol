pragma solidity ^0.6.4;

import "../PrizeStrategyInterface.sol";
import "../PrizePoolInterface.sol";

contract MockPrizeStrategy is PrizeStrategyInterface {
  uint256 public exitFee;
  uint256 public unlockTimestamp;
  PrizePoolInterface public override prizePool;

  function setExitFee(uint256 _exitFee) external {
    exitFee = _exitFee;
  }

  function setUnlockTimestamp(uint256 _unlockTimestamp) external {
    unlockTimestamp = _unlockTimestamp;
  }

  function setPrizePool(PrizePoolInterface _prizePool) external {
    prizePool = _prizePool;
  }

  function calculateExitFee(address, uint256) external view override returns (uint256) {
    return exitFee;
  }

  function calculateUnlockTimestamp(address, uint256) external view override returns (uint256) {
    return unlockTimestamp;
  }

  function award(address user, uint256 amount) external {
    prizePool.award(user, amount);
  }
}