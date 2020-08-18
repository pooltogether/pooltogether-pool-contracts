pragma solidity 0.6.4;

/// @title Prize Strategy Interface
/// @notice Required interface for a Prize Strategy to implement controls over various components
/// @dev Defines the spec required to be implemented by a Prize Strategy.
interface PrizeStrategyInterface {

  /// @dev Inheriting contract must handle to token transfers into and out of the Prize Pool to account for balance changes
  /// @param from The address of the sender of the token transfer
  /// @param to The address of the receiver of the token transfer
  /// @param amount The amount of tokens transferred
  /// @param controlledToken The address of the token that was transferred
  function beforeTokenTransfer(address from, address to, uint256 amount, address controlledToken) external;
}