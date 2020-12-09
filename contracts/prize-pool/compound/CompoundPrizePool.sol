// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "../../external/compound/CTokenInterface.sol";
import "../PrizePool.sol";

/// @title Prize Pool with Compound's cToken
/// @notice Manages depositing and withdrawing assets from the Prize Pool
contract CompoundPrizePool is PrizePool {
  using SafeMathUpgradeable for uint256;

  event CompoundPrizePoolInitialized(address indexed cToken);

  /// @notice Interface for the Yield-bearing cToken by Compound
  CTokenInterface public cToken;

  /// @notice Initializes the Prize Pool and Yield Service with the required contract connections
  /// @param _controlledTokens Array of addresses for the Ticket and Sponsorship Tokens controlled by the Prize Pool
  /// @param _maxExitFeeMantissa The maximum exit fee size, relative to the withdrawal amount
  /// @param _maxTimelockDuration The maximum length of time the withdraw timelock could be
  /// @param _cToken Address of the Compound cToken interface
  function initialize (
    RegistryInterface _reserveRegistry,
    ControlledTokenInterface[] memory _controlledTokens,
    uint256 _maxExitFeeMantissa,
    uint256 _maxTimelockDuration,
    CTokenInterface _cToken
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
    cToken = _cToken;

    emit CompoundPrizePoolInitialized(address(cToken));
  }

  /// @dev Gets the balance of the underlying assets held by the Yield Service
  /// @return The underlying balance of asset tokens
  function _balance() internal override returns (uint256) {
    return cToken.balanceOfUnderlying(address(this));
  }

  /// @dev Allows a user to supply asset tokens in exchange for yield-bearing tokens
  /// to be held in escrow by the Yield Service
  /// @param amount The amount of asset tokens to be supplied
  function _supply(uint256 amount) internal override {
    _token().approve(address(cToken), amount);
    require(cToken.mint(amount) == 0, "CompoundPrizePool/mint-failed");
  }

  /// @dev Checks with the Prize Pool if a specific token type may be awarded as a prize enhancement
  /// @param _externalToken The address of the token to check
  /// @return True if the token may be awarded, false otherwise
  function _canAwardExternal(address _externalToken) internal override view returns (bool) {
    return _externalToken != address(cToken);
  }

  /// @dev Allows a user to redeem yield-bearing tokens in exchange for the underlying
  /// asset tokens held in escrow by the Yield Service
  /// @param amount The amount of underlying tokens to be redeemed
  /// @return The actual amount of tokens transferred
  function _redeem(uint256 amount) internal override returns (uint256) {
    IERC20Upgradeable assetToken = _token();
    uint256 before = assetToken.balanceOf(address(this));
    require(cToken.redeemUnderlying(amount) == 0, "CompoundPrizePool/redeem-failed");
    uint256 diff = assetToken.balanceOf(address(this)).sub(before);
    return diff;
  }

  /// @dev Gets the underlying asset token used by the Yield Service
  /// @return A reference to the interface of the underling asset token
  function _token() internal override view returns (IERC20Upgradeable) {
    return IERC20Upgradeable(cToken.underlying());
  }
}
