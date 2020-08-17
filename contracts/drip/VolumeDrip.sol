pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "../utils/ExtendedSafeCast.sol";

library VolumeDrip {
  using SafeMath for uint256;
  using SafeCast for uint256;
  using ExtendedSafeCast for uint256;

  struct Deposit {
    uint112 balance;
    uint16 period;
    uint128 accrued;
  }

  struct Period {
    uint224 totalSupply;
    uint32 startTime;
  }

  struct State {
    mapping(address => Deposit) deposits;
    mapping(uint32 => Period) periods;
    uint32 periodSeconds;
    uint128 dripAmount;
    uint16 currentPeriodIndex;
  }

  function initialize(
    State storage self,
    uint32 _periodSeconds,
    uint128 dripAmount,
    uint32 startTime
  ) internal {
    require(_periodSeconds > 0, "VolumeDrip/period-gt-zero");
    self.periods[0] = Period({
      totalSupply: 0,
      startTime: startTime
    });
    self.periodSeconds = _periodSeconds;
    self.dripAmount = dripAmount;
  }

  function isPeriodOver(State storage self, uint256 currentTime) internal view returns (bool) {
    return currentTime >= currentPeriodEndAt(self);
  }

  function currentPeriodEndAt(State storage self) internal view returns (uint256) {
    return uint256(self.periods[self.currentPeriodIndex].startTime).add(self.periodSeconds);
  }

  function completePeriod(State storage self, uint256 currentTime) internal onlyPeriodOver(self, currentTime) {
    uint256 lastStartTime = self.periods[self.currentPeriodIndex].startTime;
    uint256 numberOfPeriods = currentTime.sub(lastStartTime).div(self.periodSeconds);
    uint256 startTime = lastStartTime.add(numberOfPeriods.mul(self.periodSeconds));
    self.currentPeriodIndex = uint256(self.currentPeriodIndex).add(1).toUint16();
    self.periods[self.currentPeriodIndex] = Period({
      totalSupply: 0,
      startTime: startTime.toUint32()
    });
  }

  function calculateAccrued(
    State storage self,
    uint16 depositPeriod,
    uint128 balance
  )
    internal view
    returns (uint256)
  {
    uint256 accrued;
    if (depositPeriod < self.currentPeriodIndex && self.periods[depositPeriod].totalSupply > 0) {
      uint256 fractionMantissa = FixedPoint.calculateMantissa(balance, self.periods[depositPeriod].totalSupply);
      accrued = FixedPoint.multiplyUintByMantissa(self.dripAmount, fractionMantissa);
    }


    return accrued;
  }

  function mint(State storage self, address user, uint256 amount, uint256 currentTime) internal onlyPeriodNotOver(self, currentTime) {
    uint256 accrued = calculateAccrued(self, self.deposits[user].period, self.deposits[user].balance);
    uint16 currentPeriod = self.currentPeriodIndex;
    if (accrued > 0) {
      self.deposits[user] = Deposit({
        balance: amount.toUint112(),
        period: currentPeriod,
        accrued: uint256(self.deposits[user].accrued).add(accrued).toUint128()
      });
    } else {
      self.deposits[user] = Deposit({
        balance: uint256(self.deposits[user].balance).add(amount).toUint112(),
        period: currentPeriod,
        accrued: self.deposits[user].accrued
      });
    }
    self.periods[currentPeriod].totalSupply = uint256(self.periods[currentPeriod].totalSupply).add(amount).toUint128();
  }

  function balanceOf(State storage self, address user) internal view returns (Deposit memory) {
    uint256 accrued = calculateAccrued(self, self.deposits[user].period, self.deposits[user].balance);
    uint112 newBalance;
    if (accrued > 0) {
      newBalance = 0;
    } else {
      newBalance = self.deposits[user].balance;
    }
    accrued = accrued.add(self.deposits[user].accrued);
    return Deposit({
      balance: newBalance,
      period: self.currentPeriodIndex,
      accrued: accrued.toUint128()
    });
  }

  function currentPeriod(State storage self) internal view returns (Period memory) {
    return self.periods[self.currentPeriodIndex];
  }

  function burnDrip(State storage self, address user) internal returns (uint256 accrued) {
    Deposit memory deposit = balanceOf(self, user);
    accrued = deposit.accrued;
    deposit.accrued = 0;
    self.deposits[user] = deposit;
    return accrued;
  }

  modifier onlyPeriodNotOver(State storage self, uint256 _currentTime) {
    require(!isPeriodOver(self, _currentTime), "VolumeDrip/period-over");
    _;
  }

  modifier onlyPeriodOver(State storage self, uint256 _currentTime) {
    require(isPeriodOver(self, _currentTime), "VolumeDrip/period-not-over");
    _;
  }
}
