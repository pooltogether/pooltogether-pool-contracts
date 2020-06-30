pragma solidity ^0.6.4;

interface ComptrollerInterface {
  function beforeTokenTransfer(address from, address to, uint256 amount, address token) external;
  function afterDepositTo(address to, uint256 amount, address token) external;
  function afterWithdrawWithTimelockFrom(address from, uint256 amount, address token) external;
  function afterWithdrawInstantlyFrom(
    address operator,
    address from,
    uint256 amount,
    address token,
    uint256 exitFee,
    uint256 sponsoredExitFee
  ) external;
  function afterSweepTimelockedWithdrawal(address operator, address from, uint256 amount) external;

  function calculateInstantWithdrawalFee(address from, uint256 amount, address token) external returns (uint256);
  function calculateWithdrawalUnlockTimestamp(address from, uint256 amount, address token) external returns (uint256);
}