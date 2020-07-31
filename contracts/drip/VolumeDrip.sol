pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@nomiclabs/buidler/console.sol";

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
    uint32 periodSeconds;
    uint128 dripAmount;
    mapping(address => Deposit) deposits;
    Period[] periods;
  }

  function initialize(State storage self, uint32 _periodSeconds, uint128 dripAmount, uint32 startTime) internal {
    require(_periodSeconds > 0, "VolumeDrip/period-gt-zero");
    self.periods.push(
      Period({
        totalSupply: 0,
        startTime: startTime
      })
    );
    self.periodSeconds = _periodSeconds;
    self.dripAmount = dripAmount;
  }

  function isPeriodOver(State storage self, uint256 currentTime) internal view returns (bool) {
    return currentTime >= uint256(self.periods[_currentPeriodIndex(self)].startTime).add(self.periodSeconds);
  }

  function completePeriod(State storage self, uint256 currentTime) internal onlyPeriodOver(self, currentTime) {
    uint256 lastStartTime = self.periods[_currentPeriodIndex(self)].startTime;
    uint256 numberOfPeriods = currentTime.sub(lastStartTime).div(self.periodSeconds);
    uint256 startTime = lastStartTime.add(numberOfPeriods.mul(self.periodSeconds));
    self.periods.push(
      Period({
        totalSupply: 0,
        startTime: startTime.toUint32()
      })
    );
  }

  function calculateAccrued(
    State storage self,
    uint16 depositPeriod,
    uint128 balance
  )
    internal view
    returns (uint256)
  {
    // first let's check to see if the previous period has completed
    if (depositPeriod < _currentPeriodIndex(self) && self.periods[depositPeriod].totalSupply > 0) {
      // claim their past period
      uint256 fractionMantissa = FixedPoint.calculateMantissa(balance, self.periods[depositPeriod].totalSupply);
      return FixedPoint.multiplyUintByMantissa(self.dripAmount, fractionMantissa);
    }

    return 0;
  }

  function mint(State storage self, address user, uint256 amount, uint256 currentTime) internal {
    // console.log("mint() mint %s to %s at %s", amount, user, currentTime);
    if (isPeriodOver(self, currentTime)) {
      completePeriod(self, currentTime);
    }
    uint256 accrued = calculateAccrued(self, self.deposits[user].period, self.deposits[user].balance);
    uint16 currentPeriod = _currentPeriodIndex(self);
    // console.log("mint() currentPeriod: %s", currentPeriod);
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
    // console.log("mint() totalSupply: %s", self.periods[currentPeriod].totalSupply);
  }

  function balanceOf(State storage self, address user, uint256 currentTime) internal returns (Deposit memory) {
    // console.log("balanceOf() user and currentTime: %s, %s", user, currentTime);
    if (isPeriodOver(self, currentTime)) {
      // console.log("balanceOf() period is over");
      completePeriod(self, currentTime);
    }
    // console.log("balanceOf() period / balance: %s / %s", self.deposits[user].period, self.deposits[user].balance);
    uint256 accrued = calculateAccrued(self, self.deposits[user].period, self.deposits[user].balance);
    // console.log("balanceOf() accrued: %s", accrued);
    uint112 newBalance;
    if (accrued > 0) {
      newBalance = 0;
    } else {
      newBalance = self.deposits[user].balance;
    }
    // console.log("VolumeDrip balanceOf(): newBalance: %s", newBalance);
    accrued = accrued.add(self.deposits[user].accrued);
    return Deposit({
      balance: newBalance,
      period: _currentPeriodIndex(self),
      accrued: accrued.toUint128()
    });
  }

  function burnDrip(State storage self, address user, uint256 currentTime) internal returns (uint256 accrued) {
    Deposit memory deposit = balanceOf(self, user, currentTime);
    // console.log("burnDrip balance of %s is %s for period %s", user, deposit.balance, deposit.period);
    // console.log("current time: %s", currentTime);
    // console.log("period start: %s", self.periods[_currentPeriodIndex(self)].startTime);
    accrued = deposit.accrued;
    deposit.accrued = 0;
    self.deposits[user] = deposit;
    return accrued;
  }

  function _currentPeriodIndex(State storage self) internal view returns (uint16) {
    return self.periods.length.sub(1).toUint16();
  }

  modifier onlyPeriodOver(State storage self, uint256 _currentTime) {
    require(isPeriodOver(self, _currentTime), "VolumeDrip/period-not-over");
    _;
  }
}
