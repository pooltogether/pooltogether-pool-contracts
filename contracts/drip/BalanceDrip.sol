pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@nomiclabs/buidler/console.sol";

library BalanceDrip {
  using SafeMath for uint256;
  using SafeCast for uint256;

  struct UserState {
    uint128 lastExchangeRateMantissa;
    uint128 dripBalance;
  }

  struct State {
    uint256 dripRatePerSecond;
    uint128 exchangeRateMantissa;
    uint32 timestamp;
    mapping(address => UserState) userStates;
  }

  function initialize(State storage self, uint256 timestamp) internal {
    self.exchangeRateMantissa = FixedPoint.SCALE.toUint128();
    self.timestamp = timestamp.toUint32();
  }

  function updateExchangeRate(
    State storage self,
    uint256 measureTotalSupply,
    uint256 timestamp
  ) internal {
    // this should only run once per block.
    if (self.timestamp == uint32(timestamp)) {
      return;
    }

    uint256 newSeconds = timestamp.sub(self.timestamp);

    if (newSeconds > 0 && self.dripRatePerSecond > 0) {
      uint256 newTokens = newSeconds.mul(self.dripRatePerSecond);
      uint256 indexDeltaMantissa = measureTotalSupply > 0 ? FixedPoint.calculateMantissa(newTokens, measureTotalSupply) : 0;
      self.exchangeRateMantissa = uint256(self.exchangeRateMantissa).add(indexDeltaMantissa).toUint128();
      self.timestamp = timestamp.toUint32();
    } else {
      self.timestamp = timestamp.toUint32();
    }
  }

  function drip(
    State storage self,
    address user,
    uint256 userMeasureBalance,
    uint256 measureTotalSupply,
    uint256 timestamp
  ) internal returns (uint128) {
    updateExchangeRate(self, measureTotalSupply, timestamp);
    return dripUser(
      self,
      user,
      userMeasureBalance
    );
  }

  function dripUser(
    State storage self,
    address user,
    uint256 userMeasureBalance
  ) internal returns (uint128) {
    UserState storage userState = self.userStates[user];
    uint256 lastExchangeRateMantissa = userState.lastExchangeRateMantissa;
    if (lastExchangeRateMantissa == 0) {
      // if the index is not intialized
      lastExchangeRateMantissa = self.exchangeRateMantissa;
    }

    uint256 deltaExchangeRateMantissa = uint256(self.exchangeRateMantissa).sub(lastExchangeRateMantissa);
    uint256 newTokens = FixedPoint.multiplyUintByMantissa(userMeasureBalance, deltaExchangeRateMantissa);
    uint128 newDripBalance = uint256(userState.dripBalance).add(newTokens).toUint128();
    self.userStates[user] = UserState({
      lastExchangeRateMantissa: self.exchangeRateMantissa,
      dripBalance: newDripBalance
    });

    return newDripBalance;
  }

  function burnDrip(
    State storage self,
    address user,
    uint256 amount
  ) internal {
    UserState storage userState = self.userStates[user];
    userState.dripBalance = uint256(userState.dripBalance).sub(amount).toUint128();
  }
}
