pragma solidity ^0.6.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./ControlledToken.sol";

interface InterestPoolInterface {
  function availableInterest() external view returns (uint256);
  function allocateInterest(address to, uint256 amount) external;
  function estimateAccruedInterestOverBlocks(uint256 principal, uint256 blocks) external view returns (uint256);
  function accountedBalance() external view returns (uint256);
  function underlying() external view returns (IERC20);
  function collateral() external view returns (ControlledToken);
  function supply(uint256 amount) external;
  function redeem(uint256 amount) external;
}
