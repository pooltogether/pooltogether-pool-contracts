// SPDX-License-Identifier: GPL-3.0-only

pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";
import "../utils/ExtendedSafeCast.sol";
import "../external/pooltogether/FixedPoint.sol";

/// @title Calculates a users share of a token faucet.
/// @notice The tokens are dripped at a "drip rate per second".  This is the number of tokens that
/// are dripped each second to the entire supply of a "measure" token.  A user's share of ownership
/// of the measure token corresponds to the share of the drip tokens per second.
library BalanceDrip {
  using SafeMath for uint256;
  using SafeCast for uint256;
  using ExtendedSafeCast for uint256;

  struct UserState {
    uint128 lastExchangeRateMantissa;
  }

  struct State {
    uint256 dripRatePerSecond;
    uint112 exchangeRateMantissa;
    uint112 totalDripped;
    uint32 timestamp;
    mapping(address => UserState) userStates;
  }

  /// @notice Updates a users drip state and returns the number of new tokens they should receive.
  /// @param self The balance drip state
  /// @param user The user to update
  /// @param userMeasureBalance The user's last balance (prior to any change)
  /// @param measureTotalSupply The measure token's last total supply (prior to any change)
  /// @param timestamp The current time
  /// @return The number of tokens to drip to the user.
  function drip(
    State storage self,
    address user,
    uint256 userMeasureBalance,
    uint256 measureTotalSupply,
    uint256 timestamp
  ) internal returns (uint128) {
    _updateExchangeRate(self, measureTotalSupply, timestamp);
    return _dripUser(
      self,
      user,
      userMeasureBalance
    );
  }

  function poke(
    State storage self,
    address user,
    uint256 userMeasureBalance
  ) internal returns (uint128) {
    return _dripUser(
      self,
      user,
      userMeasureBalance
    );
  }

  function resetTotalDripped(State storage self) internal {
    self.totalDripped = 0;
  }

  /// @notice Sets the drip rate per second for a balance drip. It will update the balance drip before setting the drip rate.
  /// @param self The balance drip state
  /// @param measureTotalSupply The current measure total supply
  /// @param dripRatePerSecond the new drip rate per second
  /// @param currentTime The current time
  function setDripRate(
    State storage self,
    uint256 measureTotalSupply,
    uint256 dripRatePerSecond,
    uint32 currentTime
  )
    internal
  {
    _updateExchangeRate(self, measureTotalSupply, currentTime);
    self.dripRatePerSecond = dripRatePerSecond;
  }

  function _updateExchangeRate(
    State storage self,
    uint256 measureTotalSupply,
    uint256 timestamp
  ) private {
    // this should only run once per block.
    if (self.timestamp == uint32(timestamp)) {
      return;
    }

    uint256 lastTime = self.timestamp == 0 ? timestamp : self.timestamp;
    uint256 newSeconds = timestamp.sub(lastTime);

    uint112 exchangeRateMantissa = self.exchangeRateMantissa == 0 ? FixedPoint.SCALE.toUint112() : self.exchangeRateMantissa;

    uint256 newTokens;
    if (newSeconds > 0 && self.dripRatePerSecond > 0) {
      newTokens = newSeconds.mul(self.dripRatePerSecond);
      uint256 indexDeltaMantissa = measureTotalSupply > 0 ? FixedPoint.calculateMantissa(newTokens, measureTotalSupply) : 0;
      exchangeRateMantissa = uint256(exchangeRateMantissa).add(indexDeltaMantissa).toUint112();
    }

    self.exchangeRateMantissa = exchangeRateMantissa;
    self.totalDripped = uint256(self.totalDripped).add(newTokens).toUint112();
    self.timestamp = timestamp.toUint32();
  }

  function _dripUser(
    State storage self,
    address user,
    uint256 userMeasureBalance
  ) private returns (uint128) {
    UserState storage userState = self.userStates[user];
    uint256 lastExchangeRateMantissa = userState.lastExchangeRateMantissa;
    if (lastExchangeRateMantissa == 0) {
      // if the index is not intialized
      lastExchangeRateMantissa = FixedPoint.SCALE.toUint112();
    }

    uint256 deltaExchangeRateMantissa = uint256(self.exchangeRateMantissa).sub(lastExchangeRateMantissa);
    uint128 newTokens = FixedPoint.multiplyUintByMantissa(userMeasureBalance, deltaExchangeRateMantissa).toUint128();

    self.userStates[user] = UserState({
      lastExchangeRateMantissa: self.exchangeRateMantissa
    });

    return newTokens;
  }
}
