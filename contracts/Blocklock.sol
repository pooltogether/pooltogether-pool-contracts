pragma solidity ^0.5.12;

/**
 * @title Blocklock
 * @author Brendan Asselstine
 * @notice A time lock with a cooldown period.  When locked, the contract will remain locked until it is unlocked manually
 * or the lock duration expires.  After the contract is unlocked, it cannot be locked until the cooldown duration expires.
 */
library Blocklock {

  struct State {
    uint256 lockedAt;
    uint256 unlockedAt;
    uint256 lockDuration;
    uint256 cooldownDuration;
  }

  /**
   * @notice Sets the duration of the lock.  This how long the lock lasts before it expires and automatically unlocks.
   * @param self The Blocklock state
   * @param lockDuration The duration, in blocks, that the lock should last.
   */
  function setLockDuration(State storage self, uint256 lockDuration) public {
    require(lockDuration > 0, "Blocklock/lock-min");
    self.lockDuration = lockDuration;
  }

  /**
   * @notice Sets the cooldown duration in blocks.  This is the number of blocks that must pass before being able to
   * lock again.  The cooldown duration begins when the lock duration expires, or when it is unlocked manually.
   * @param self The Blocklock state
   * @param cooldownDuration The duration of the cooldown, in blocks.
   */
  function setCooldownDuration(State storage self, uint256 cooldownDuration) public {
    self.cooldownDuration = cooldownDuration;
  }

  /**
   * @notice Returns whether the state is locked at the given block number.
   * @param self The Blocklock state
   * @param blockNumber The current block number.
   */
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

  /**
   * @notice Locks the state at the given block number.
   * @param self The Blocklock state
   * @param blockNumber The block number to use as the lock start time
   */
  function lock(State storage self, uint256 blockNumber) public {
    require(canLock(self, blockNumber), "Blocklock/no-lock");
    self.lockedAt = blockNumber;
  }

  /**
   * @notice Manually unlocks the lock.
   * @param self The Blocklock state
   * @param blockNumber The block number at which the lock is being unlocked.
   */
  function unlock(State storage self, uint256 blockNumber) public {
    self.unlockedAt = blockNumber;
  }

  /**
   * @notice Returns whether the Blocklock can be locked at the given block number
   * @param self The Blocklock state
   * @param blockNumber The block number to check against
   * @return True if we can lock at the given block number, false otherwise.
   */
  function canLock(State storage self, uint256 blockNumber) public view returns (bool) {
    return (
      self.lockedAt == 0 ||
      blockNumber >= self.lockedAt + self.lockDuration + self.cooldownDuration
    );
  }
}
