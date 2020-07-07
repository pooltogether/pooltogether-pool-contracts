pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

abstract contract AbstractYieldService {
  event PrincipalSupplied(address from, uint256 amount);
  event PrincipalRedeemed(address from, uint256 amount);

  function token() external virtual view returns (IERC20) {
    return _token();
  }

  function balance() external virtual returns (uint256) {
    return _balance();
  }

  function _token() internal virtual view returns (IERC20);
  function _balance() internal virtual returns (uint256);
  function _supply(uint256 mintAmount) internal virtual;
  function _redeem(uint256 redeemAmount) internal virtual;
  function estimateAccruedInterestOverBlocks(uint256 principal, uint256 blocks) public virtual view returns (uint256);
}
