pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";

import "../comptroller/ComptrollerInterface.sol";

contract MockComptroller is ComptrollerInterface {
  uint256 public override reserveRateMantissa;

  function setReserveFeeMantissa(uint256 _reserveRateMantissa) public {
    reserveRateMantissa = _reserveRateMantissa;
  }

  /// @notice Called when tokens are minted.
  /// @param to The address of the receiver of the minted tokens.
  /// @param amount The amount of tokens being minted
  /// @param controlledToken The address of the token that is being minted
  /// @param referrer The address that referred the minting.
  function beforeTokenMint(address to, uint256 amount, address controlledToken, address referrer) external override {}

  /// @notice Called when tokens are transferred or burned.
  /// @param from The address of the sender of the token transfer
  /// @param to The address of the receiver of the token transfer.  Will be the zero address if burning.
  /// @param amount The amount of tokens transferred
  /// @param controlledToken The address of the token that was transferred
  function beforeTokenTransfer(address from, address to, uint256 amount, address controlledToken) external override {}
}