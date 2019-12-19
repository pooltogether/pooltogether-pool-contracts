pragma solidity 0.5.12;

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
    uint256 endAt = lockEndAt(self);
    return (
      self.lockedAt != 0 &&
      blockNumber >= self.lockedAt &&
      blockNumber < endAt
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
    uint256 endAt = lockEndAt(self);
    return (
      self.lockedAt == 0 ||
      blockNumber >= endAt + self.cooldownDuration
    );
  }

  function lockEndAt(State storage self) internal view returns (uint256) {
    uint256 endAt = self.lockedAt + self.lockDuration;
    // if we unlocked early
    if (self.unlockedAt >= self.lockedAt && self.unlockedAt < endAt) {
      endAt = self.unlockedAt;
    }
    return endAt;
  }
}
