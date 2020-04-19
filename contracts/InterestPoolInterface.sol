pragma solidity ^0.6.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface InterestPoolInterface {
  function availableInterest() external view returns (uint256);
  function estimateAccruedInterest(uint256 principal, uint256 blocks) external view returns (uint256);
  function allocateInterest(address to, uint256 amount) external;
  function supplyRatePerBlock() external view returns (uint256);
  function accountedBalance() external view returns (uint256);
  function underlyingToken() external view returns (IERC20);
  function supplyCollateral(uint256 amount) external;
  function redeemCollateral(uint256 amount) external;
}