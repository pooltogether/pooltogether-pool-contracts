pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

/// @title Yield-based Prize Pool Base Class
/// @notice Required interface for Prize Pools with a specific Yield Service
/// @dev Defines the spec required to be implemented by a Yield-bearing Prize Pool.
/// Can be divided into two parts; the Prize Pool and the Yield Service.
abstract contract AbstractYieldService {
  event PrincipalSupplied(address from, uint256 amount);
  event PrincipalRedeemed(address from, uint256 amount);

  /// @dev Gets the underlying asset token used by the Yield Service
  /// @return A reference to the interface of the underling asset token
  function token() external virtual view returns (IERC20) {
    return _token();
  }

  /// @dev Gets the balance of the underlying assets held by the Yield Service
  /// @return The underlying balance of asset tokens
  function balance() external virtual returns (uint256) {
    return _balance();
  }

  /// @dev Checks with the Prize Pool if a specific token type may be awarded as a prize enhancement
  /// @param _token The address of the token to check
  /// @return True if the token may be awarded, false otherwise
  function canAwardExternal(address _token) external virtual view returns (bool) {
    return _canAwardExternal(_token);
  }

  /// @dev Inheriting contract must determine if a specific token type may be awarded as a prize enhancement
  /// @param _token The address of the token to check
  /// @return True if the token may be awarded, false otherwise
  function _canAwardExternal(address _token) internal virtual view returns (bool);

  /// @dev Inheriting contract must return an interface to the underlying asset token that conforms to the ERC20 spec
  /// @return A reference to the interface of the underling asset token
  function _token() internal virtual view returns (IERC20);

  /// @dev Inheriting contract must return the balance of the underlying assets held by the Yield Service
  /// @return The underlying balance of asset tokens
  function _balance() internal virtual returns (uint256);

  /// @dev Inheriting contract must provide the ability to supply asset tokens in exchange
  /// for yield-bearing tokens to be held in escrow by the Yield Service
  /// @param mintAmount The amount of asset tokens to be supplied
  function _supply(uint256 mintAmount) internal virtual;

  /// @dev Inheriting contract must provide the ability to redeem yield-bearing tokens in exchange
  /// for the underlying asset tokens held in escrow by the Yield Service
  /// @param redeemAmount The amount of yield-bearing tokens to be redeemed
  function _redeem(uint256 redeemAmount) internal virtual;

  /// @dev Inheriting contract must provide an estimate for the amount of accrued interest that would
  /// be applied to the `principal` amount over a given number of `blocks`
  /// @param principal The amount of asset tokens to provide an estimate on
  /// @param blocks The number of blocks that the principal would accrue interest over
  /// @return The estimated interest that would accrue on the principal
  function estimateAccruedInterestOverBlocks(uint256 principal, uint256 blocks) public virtual view returns (uint256);
}
