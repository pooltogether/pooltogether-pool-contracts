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

  /// @dev Inheriting contract must handle deposits into the Prize Pool and account for balance changes
  /// @param to The address of the account who is receiving the deposit
  /// @param amount The amount of the deposit to account for
  /// @param controlledToken The address of the token that was deposited
  function afterDepositTo(address to, uint256 amount, address controlledToken) external;

  /// @notice Called by the Prize Pool after a user converts their timelocked tokens into a deposit
  /// @dev Inheriting contract must handle deposits into the Prize Pool and account for balance changes
  /// @param operator The user whose timelock was re-deposited
  /// @param to The address of the account who is receiving the deposit
  /// @param amount The amount of the deposit to account for
  /// @param controlledToken The address of the token that was deposited
  function afterTimelockDepositTo(address operator, address to, uint256 amount, address controlledToken) external;

  /// @dev Inheriting contract must provide a view into the unlock timestamp for a timelocked withdrawal
  /// @param from The address of the account to withdraw from
  /// @param amount The amount of the withdrawal to account for
  /// @param controlledToken The address of the token to be withdrawn
  /// @return The unlock timestamp for releasing locked assets
  function beforeWithdrawWithTimelockFrom(address from, uint256 amount, address controlledToken) external returns (uint256);

  /// @dev Inheriting contract must handle withdrawals from the Prize Pool that have a timelock on the Assets
  /// @param from The address of the account who performed the withdrawal
  /// @param amount The amount of the withdrawal to account for
  /// @param controlledToken The address of the token to be withdrawn
  function afterWithdrawWithTimelockFrom(address from, uint256 amount, address controlledToken) external;

  /// @dev Inheriting contract must provide a view into the exit "fairness" fee for an instant withdrawal
  /// @param from The address of the account to withdraw from
  /// @param amount The amount of the withdrawal to account for
  /// @param controlledToken The address of the token to be withdrawn
  /// @return The exit "fairness" fee required to withdraw instantly
  function beforeWithdrawInstantlyFrom(address from, uint256 amount, address controlledToken) external returns (uint256);

  /// @dev Inheriting contract must handle instant withdrawals from the Prize Pool
  /// @param operator The address of an approved operator who performed the withdrawal
  /// @param from The address of the account to withdraw from
  /// @param amount The amount of the withdrawal to account for
  /// @param controlledToken The address of the token withdrawn
  /// @param exitFee The amount of the exit "fairness" fee charged for the withdrawal
  /// @param sponsoredExitFee The amount of asset tokens paid by the operator to cover the exit fee on behalf of the owner
  function afterWithdrawInstantlyFrom(
    address operator,
    address from,
    uint256 amount,
    address controlledToken,
    uint256 exitFee,
    uint256 sponsoredExitFee
  ) external;

  /// @dev Inheriting contract must handle swept assets on the Prize Pool
  /// @param operator The address of the operator who performed the sweep
  /// @param from The address of the account that received the swept assets
  /// @param amount The amount of the asset tokens that were swept
  function afterSweepTimelockedWithdrawal(address operator, address from, uint256 amount) external;
}