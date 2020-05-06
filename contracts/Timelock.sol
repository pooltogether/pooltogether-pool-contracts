pragma solidity ^0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";

library Timelock {
  using SafeMath for uint256;

  struct State {
    uint256 amount;
    uint256 timestamp;
  }

  /**
   * Deposits into the timelock the given amount and the unlock block.
   * @param self The state
   * @param amount The amount to lock
   * @param timestamp The timestamp at which to unlock the funds
   */
  function deposit(
    State storage self,
    uint256 amount,
    uint256 timestamp
  ) internal returns (uint256 previousAmount, uint256 previousTimestamp) {
    require(timestamp >= self.timestamp, "Timelock/forward");
    if (self.timestamp == timestamp) {
      self.amount = self.amount.add(amount);
    } else {
      previousAmount = self.amount;
      previousTimestamp = self.timestamp;
      self.amount = amount;
      self.timestamp = timestamp;
    }
  }

  function withdrawAt(State storage self, uint256 currentTimestamp) internal returns (uint256 previousAmount, uint256 previousTimestamp) {
    if (self.timestamp <= currentTimestamp) {
      previousAmount = self.amount;
      previousTimestamp = self.timestamp;
      self.amount = 0;
      self.timestamp = 0;
    }
  }

  function balanceAt(State storage self, uint256 currentTimestamp) internal view returns (uint256 amount, uint256 timestamp) {
    if (self.timestamp <= currentTimestamp) {
      amount = self.amount;
      timestamp = self.timestamp;
    }
  }
}