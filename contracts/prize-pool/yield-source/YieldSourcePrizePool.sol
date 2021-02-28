// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "../../yield-source/YieldSourceInterface.sol";
import "../PrizePool.sol";

contract YieldSourcePrizePool is PrizePool {

  YieldSourceInterface public yieldSource;

  event YieldSourcePrizePoolInitialized(address indexed yieldSource);

  /// @notice Initializes the Prize Pool and Yield Service with the required contract connections
  /// @param _controlledTokens Array of addresses for the Ticket and Sponsorship Tokens controlled by the Prize Pool
  /// @param _maxExitFeeMantissa The maximum exit fee size, relative to the withdrawal amount
  /// @param _maxTimelockDuration The maximum length of time the withdraw timelock could be
  /// @param _yieldSource Address of the yield source
  function initializeYieldSourcePrizePool (
    RegistryInterface _reserveRegistry,
    ControlledTokenInterface[] memory _controlledTokens,
    uint256 _maxExitFeeMantissa,
    uint256 _maxTimelockDuration,
    YieldSourceInterface _yieldSource
  )
    public
    initializer
  {
    PrizePool.initialize(
      _reserveRegistry,
      _controlledTokens,
      _maxExitFeeMantissa,
      _maxTimelockDuration
    );
    yieldSource = _yieldSource;

    emit YieldSourcePrizePoolInitialized(address(yieldSource));
  }

  /// @notice Determines whether the passed token can be transferred out as an external award.
  /// @dev Different yield sources will hold the deposits as another kind of token: such a Compound's cToken.  The
  /// prize strategy should not be allowed to move those tokens.
  /// @param _externalToken The address of the token to check
  /// @return True if the token may be awarded, false otherwise
  function _canAwardExternal(address _externalToken) internal override view returns (bool) {
    return _externalToken != address(yieldSource);
  }

  /// @notice Returns the total balance (in asset tokens).  This includes the deposits and interest.
  /// @return The underlying balance of asset tokens
  function _balance() internal override returns (uint256) {
    return yieldSource.balanceOf(address(this));
  }

  function _token() internal override view returns (IERC20Upgradeable) {
    return yieldSource.token();
  }

  /// @notice Supplies asset tokens to the yield source.
  /// @param mintAmount The amount of asset tokens to be supplied
  function _supply(uint256 mintAmount) internal override {
    yieldSource.token().approve(address(yieldSource), mintAmount);
    yieldSource.supplyTo(mintAmount, address(this));
  }

  /// @notice Redeems asset tokens from the yield source.
  /// @param redeemAmount The amount of yield-bearing tokens to be redeemed
  /// @return The actual amount of tokens that were redeemed.
  function _redeem(uint256 redeemAmount) internal override returns (uint256) {
    return yieldSource.redeem(redeemAmount);
  }
}