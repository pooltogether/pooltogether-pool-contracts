pragma solidity 0.5.12;

import "../Blocklock.sol";

contract ExposedBlocklock {
  using Blocklock for Blocklock.State;

  Blocklock.State state;

  function setLockDuration(uint256 lockDuration) public {
    state.setLockDuration(lockDuration);
  }

  function setCooldownDuration(uint256 cooldownDuration) public {
    state.setCooldownDuration(cooldownDuration);
  }

  function isLocked(uint256 blockNumber) public view returns (bool) {
    return state.isLocked(blockNumber);
  }

  function lock(uint256 blockNumber) public {
    state.lock(blockNumber);
  }

  function unlock(uint256 blockNumber) public {
    state.unlock(blockNumber);
  }

  function canLock(uint256 blockNumber) public view returns (bool) {
    return state.canLock(blockNumber);
  }

  function lockDuration() public view returns (uint256) {
    return state.lockDuration;
  }

  function cooldownDuration() public view returns (uint256) {
    return state.cooldownDuration;
  }

  function cooldownEndAt() public view returns (uint256) {
    return state.cooldownEndAt();
  }

  function lockEndAt() public view returns (uint256) {
    return state.lockEndAt();
  }
}
