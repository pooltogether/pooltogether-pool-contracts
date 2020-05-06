pragma solidity ^0.6.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface InterestPoolInterface {
  function token() external view returns (IERC20);
  function balanceOf(address owner) external view returns (uint256);
  function supply(uint256 mintAmount) external;
  function redeem(uint256 redeemAmount) external;
  function estimateAccruedInterestOverBlocks(uint256 principal, uint256 blocks) external view returns (uint256);
}
