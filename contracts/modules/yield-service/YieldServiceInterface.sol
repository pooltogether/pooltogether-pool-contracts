pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

interface YieldServiceInterface {
  function token() external view returns (IERC20);
  function balance() external returns (uint256);
  function accountedBalance() external view returns (uint256);
  function unaccountedBalance() external returns (uint256);
  function supply(address from, uint256 mintAmount) external;
  function redeem(address to, uint256 redeemAmount) external;
  function capture(uint256 amount) external;
  function estimateAccruedInterestOverBlocks(uint256 principal, uint256 blocks) external view returns (uint256);
}
