pragma solidity ^0.5.12;

/**
 * Implements a "lock" feature with a cooldown
 */
library Blocklock {

  struct State {
    uint256 lockedAt;
    uint256 unlockedAt;
    uint256 lockDuration;
    uint256 cooldownDuration;
  }

  function setLockDuration(State storage self, uint256 lockDuration) public {
    require(lockDuration > 0, "Blocklock/lock-min");
    self.lockDuration = lockDuration;
  }

  function setCooldownDuration(State storage self, uint256 cooldownDuration) public {
    self.cooldownDuration = cooldownDuration;
  }

  function isLocked(State storage self, uint256 blockNumber) public view returns (bool) {
    uint256 lockEndAt = self.lockedAt + self.lockDuration;
    // if we unlocked early
    if (self.unlockedAt >= self.lockedAt && self.unlockedAt < lockEndAt) {
      lockEndAt = self.unlockedAt;
    }
    return (
      self.lockedAt != 0 &&
      blockNumber >= self.lockedAt &&
      blockNumber < lockEndAt
    );
  }

  function lock(State storage self, uint256 blockNumber) public {
    require(canLock(self, blockNumber), "Blocklock/no-lock");
    self.lockedAt = blockNumber;
  }

  function unlock(State storage self, uint256 blockNumber) public {
    self.unlockedAt = blockNumber;
  }

  function canLock(State storage self, uint256 blockNumber) public view returns (bool) {
    return (
      self.lockedAt == 0 ||
      blockNumber >= self.lockedAt + self.lockDuration + self.cooldownDuration
    );
  }
}
