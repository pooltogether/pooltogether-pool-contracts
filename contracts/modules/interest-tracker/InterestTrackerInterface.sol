pragma solidity ^0.6.4;

interface InterestTrackerInterface {
  function accrueInterest(uint256 amount) external;
  function balanceOfInterest(address user) external view returns (uint256);
  function balanceOfCollateral(address user) external view returns (uint256);
  function balanceOf(address user) external view returns (uint256);
  function supplyCollateral(address from, uint256 amount) external;
  function redeemCollateral(address from, uint256 amount) external;
  function transferCollateral(address from, address to, uint256 amount) external;
  function interestRatioMantissa(address user) external view returns (uint256);
}