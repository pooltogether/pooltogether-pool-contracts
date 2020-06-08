pragma solidity ^0.6.4;

interface CollateralInterface {
  function spread(uint256 amount) external;
  function supply(address account, uint256 amount) external;
  function redeem(address account, uint256 amount) external;
  // function balanceOf(address user) external view returns (uint256);
}