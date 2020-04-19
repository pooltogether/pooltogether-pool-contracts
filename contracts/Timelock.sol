pragma solidity ^0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";

library Timelock {
  using SafeMath for uint256;

  struct State {
    uint256 amount;
    uint256 unlockBlock;
  }

  /**
   * Deposits into the timelock the given amount and the unlock block.
   * @param self The state
   * @param amount The amount to lock
   * @param unlockBlock The block at which to unlock the funds
   */
  function deposit(
    State storage self,
    uint256 amount,
    uint256 unlockBlock
  ) internal returns (uint256 previousAmount, uint256 previousUnlockBlock) {
    require(unlockBlock >= self.unlockBlock, "Timelock/forward");
    if (self.unlockBlock == unlockBlock) {
      self.amount = self.amount.add(amount);
    } else {
      previousAmount = self.amount;
      previousUnlockBlock = self.unlockBlock;
      self.amount = amount;
      self.unlockBlock = unlockBlock;
    }
  }

  function withdrawAt(State storage self, uint256 blockNumber) internal returns (uint256 previousAmount, uint256 previousUnlockBlock) {
    if (self.unlockBlock <= blockNumber) {
      previousAmount = self.amount;
      previousUnlockBlock = self.unlockBlock;
      self.amount = 0;
      self.unlockBlock = 0;
    }
  }

  function balanceAt(State storage self, uint256 blockNumber) internal view returns (uint256 amount, uint256 unlockBlock) {
    if (self.unlockBlock <= blockNumber) {
      amount = self.amount;
      unlockBlock = self.unlockBlock;
    }
  }
}