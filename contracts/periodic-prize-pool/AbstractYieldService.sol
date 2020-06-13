pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

abstract contract AbstractYieldService {
  function token() external virtual view returns (IERC20) {
    return _token();
  }

  function balance() external virtual returns (uint256) {
    return _balance();
  }

  function accountedBalance() external view returns (uint256) {
    return _accountedBalance();
  }

  function unaccountedBalance() external returns (uint256) {
    return _unaccountedBalance();
  }

  function _token() internal virtual view returns (IERC20);
  function _balance() internal virtual returns (uint256);
  function _accountedBalance() internal virtual view returns (uint256);
  function _unaccountedBalance() internal virtual returns (uint256);
  function _supply(uint256 mintAmount) internal virtual;
  function _redeem(uint256 redeemAmount) internal virtual;
  function _capture(uint256 amount) internal virtual;
  function _estimateAccruedInterestOverBlocks(uint256 principal, uint256 blocks) internal virtual view returns (uint256);
}
