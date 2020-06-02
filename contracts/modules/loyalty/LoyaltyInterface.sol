pragma solidity ^0.6.4;

interface LoyaltyInterface {
  function supply(address account, uint256 amount) external;
  function redeem(address account, uint256 amount) external;
  function reward(uint256 amount) external;
  function balanceOfUnderlying(address user) external view returns (uint256);
  function exchangeRateMantissa() external view returns (uint256);
}