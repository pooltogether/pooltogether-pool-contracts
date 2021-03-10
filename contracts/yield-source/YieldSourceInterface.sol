// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

/// @title Defines the functions used to interact with a yield source.  The Prize Pool inherits this contract.
/// @notice Prize Pools subclasses need to implement this interface so that yield can be generated.
interface YieldSourceInterface {
  /// @notice Returns the ERC20 asset token used for deposits.
  /// @return The ERC20 asset token
  function token() external view returns (IERC20Upgradeable);

  /// @notice Returns the total balance (in asset tokens).  This includes the deposits and interest.
  /// @return The underlying balance of asset tokens
  function balanceOf(address addr) external returns (uint256);

  /// @notice Supplies tokens to the yield source.  Allows assets to be supplied on other user's behalf using the `to` param.
  /// @param amount The amount of `token()` to be supplied
  /// @param to The user whose balance will receive the tokens
  function supplyTo(uint256 amount, address to) external;

  /// @notice Redeems tokens from the yield source.
  /// @param amount The amount of `token()` to withdraw.  Denominated in `token()` as above.
  /// @return The actual amount of tokens that were redeemed.
  function redeem(uint256 amount) external returns (uint256);
}
