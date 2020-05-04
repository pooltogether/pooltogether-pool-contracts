pragma solidity ^0.6.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./ControlledToken.sol";

interface InterestPoolInterface {
  function balanceOfUnderlying(address from) external view returns (uint256);
  // function mintPrincipal(uint256 amount) external;
  function estimateAccruedInterestOverBlocks(uint256 principal, uint256 blocks) external view returns (uint256);
  function underlying() external view returns (IERC20);
  // function principal() external view returns (ControlledToken);
  function supplyUnderlying(uint256 amount) external;
  function redeemUnderlying(uint256 amount) external;
}
