// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/SafeCastUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@nomiclabs/buidler/console.sol";

import "../utils/ExtendedSafeCast.sol";
import "../token/TokenListener.sol";

/// @title Calculates a users share of a token faucet.
/// @notice The tokens are dripped at a "drip rate per second".  This is the number of tokens that
/// are dripped each second to the entire supply of a "measure" token.  A user's share of ownership
/// of the measure token corresponds to the share of the drip tokens per second.
/* solium-disable security/no-block-members */
contract ComptrollerV2 is OwnableUpgradeable, TokenListener {
  using SafeMathUpgradeable for uint256;
  using SafeCastUpgradeable for uint256;
  using ExtendedSafeCast for uint256;

  event Initialized(
    address indexed prizeStrategy,
    IERC20Upgradeable indexed asset,
    IERC20Upgradeable indexed measure,
    uint256 dripRatePerSecond
  );

  event Dripped(
    uint256 newTokens
  );

  event Claimed(
    address indexed user,
    uint256 newTokens
  );

  struct UserState {
    uint128 lastExchangeRateMantissa;
    uint128 balance;
  }

  address public prizeStrategy;
  IERC20Upgradeable public asset;
  IERC20Upgradeable public measure;
  uint256 public dripRatePerSecond;
  uint112 public exchangeRateMantissa;
  uint112 public totalUnclaimed;
  uint32 public lastDripTimestamp;
  mapping(address => UserState) public userStates;

  constructor (
    address _prizeStrategy,
    IERC20Upgradeable _asset,
    IERC20Upgradeable _measure,
    uint256 _dripRatePerSecond
  ) public {
    require(_dripRatePerSecond > 0, "ComptrollerV2/dripRate-gt-zero");
    __Ownable_init();
    prizeStrategy = _prizeStrategy;
    asset = _asset;
    measure = _measure;
    dripRatePerSecond = _dripRatePerSecond;
    lastDripTimestamp = _currentTime();

    emit Initialized(
      prizeStrategy,
      asset,
      measure,
      dripRatePerSecond
    );
  }

  function claim(address user) external returns (uint256) {
    _captureNewTokensForUser(user);
    uint256 balance = userStates[user].balance;
    userStates[user].balance = 0;
    totalUnclaimed = uint256(totalUnclaimed).sub(balance).toUint112();
    asset.transfer(user, balance);

    emit Claimed(user, balance);

    return balance;
  }

  /// @notice Drips new tokens.
  /// @dev Should be called immediately before any measure token transfers
  /// @return The number of new tokens dripped.
  function drip() public returns (uint256) {
    uint256 currentTimestamp = _currentTime();

    // this should only run once per block.
    if (lastDripTimestamp == uint32(currentTimestamp)) {
      return 0;
    }

    uint256 assetTotalSupply = asset.balanceOf(address(this));
    uint256 availableTotalSupply = assetTotalSupply.sub(totalUnclaimed);
    uint256 newSeconds = currentTimestamp.sub(lastDripTimestamp);
    uint112 nextExchangeRateMantissa;
    uint256 newTokens;
    uint256 measureTotalSupply = measure.totalSupply();

    // console.log("assetTotalSupply: ", assetTotalSupply);
    // console.log("availableTotalSupply: ", availableTotalSupply);
    // console.log("newSeconds: ", newSeconds);

    if (measureTotalSupply > 0 && availableTotalSupply > 0 && newSeconds > 0) {
      newTokens = newSeconds.mul(dripRatePerSecond);
      if (newTokens > availableTotalSupply) {
        newTokens = availableTotalSupply;
      }
      uint256 indexDeltaMantissa = measureTotalSupply > 0 ? FixedPoint.calculateMantissa(newTokens, measureTotalSupply) : 0;
      nextExchangeRateMantissa = uint256(exchangeRateMantissa).add(indexDeltaMantissa).toUint112();

      emit Dripped(
        newTokens
      );
    }

    exchangeRateMantissa = nextExchangeRateMantissa;
    totalUnclaimed = uint256(totalUnclaimed).add(newTokens).toUint112();
    lastDripTimestamp = currentTimestamp.toUint32();

    // console.log("exchangeRateMantissa: ", exchangeRateMantissa);
    // console.log("totalUnclaimed: ", totalUnclaimed);

    return newTokens;
  }

  /// @notice Captures new tokens for a user
  /// @dev This must be called before changes to the user's balance (i.e. before mint, transfer or burns)
  /// @param user The user to capture tokens for
  /// @return The number of new tokens
  function _captureNewTokensForUser(
    address user
  ) private returns (uint128) {
    uint256 userMeasureBalance = measure.balanceOf(user);
    UserState storage userState = userStates[user];
    uint256 deltaExchangeRateMantissa = uint256(exchangeRateMantissa).sub(userState.lastExchangeRateMantissa);
    uint128 newTokens = FixedPoint.multiplyUintByMantissa(userMeasureBalance, deltaExchangeRateMantissa).toUint128();

    // console.log("_captureNewTokensForUser newTokens: ", uint256(newTokens));

    userStates[user] = UserState({
      lastExchangeRateMantissa: exchangeRateMantissa,
      balance: uint256(userState.balance).add(newTokens).toUint128()
    });

    return newTokens;
  }

  /// @notice Called by a "source" (i.e. Prize Pool) when a user mints new "measure" tokens.
  /// @param to The user who is minting the tokens
  /// @param amount The amount of tokens they are minting
  /// @param token The token they are minting
  /// @param referrer The user who referred the minting.
  function beforeTokenMint(
    address to,
    uint256 amount,
    address token,
    address referrer
  )
    external
    override
  {
    if (token == address(measure)) {
      drip();
      _captureNewTokensForUser(to);
    }
  }

  /// @notice Called by a "source" (i.e. Prize Pool) when tokens change hands or are burned
  /// @param from The user who is sending the tokens
  /// @param to The user who is receiving the tokens
  /// @param token The token token they are burning
  function beforeTokenTransfer(
    address from,
    address to,
    uint256,
    address token
  )
    external
    override
  {
    // must be measure and not be minting
    if (token == address(measure) && from != address(0)) {
      drip();
      _captureNewTokensForUser(to);
      _captureNewTokensForUser(from);
    }
  }

  /// @notice returns the current time.  Allows for override in testing.
  /// @return The current time (block.timestamp)
  function _currentTime() internal virtual view returns (uint32) {
    return block.timestamp.toUint32();
  }

}
