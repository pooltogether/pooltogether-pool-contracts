pragma solidity ^0.6.4;

interface InterestTokenInterface {
  function underlying() external view returns (address);
  function balanceOf(address owner) external returns (uint256);
  function supply(uint256 mintAmount) external returns (uint256);
  function redeem(uint256 redeemAmount) external returns (uint256);
  function estimateAccruedInterest(uint256 amount, uint256 blocks) external view returns (uint256);
}
