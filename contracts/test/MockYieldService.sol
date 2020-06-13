pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

import "../periodic-prize-pool/AbstractYieldService.sol";

contract MockYieldService is AbstractYieldService {

  uint256 _balanceOf;
  IERC20 token;
  uint256 public supplyRatePerBlock;
  uint256 public __accountedBalance;

  function initialize (IERC20 _token) external {
    token = _token;
    supplyRatePerBlock = 100 wei;
  }

  function setBalanceOf(uint256 amount) external {
    _balanceOf = amount;
  }

  function _balance() internal override returns (uint256) {
    return _balanceOf;
  }

  function _accountedBalance() internal override view returns (uint256) {
    return __accountedBalance;
  }

  function _unaccountedBalance() internal override returns (uint256) {
    return _balanceOf - __accountedBalance;
  }

  function _estimateAccruedInterestOverBlocks(uint256, uint256) internal view override returns (uint256) {
    return 45;
  }

  function setSupplyRatePerBlock(uint256 _supplyRatePerBlock) public {
    supplyRatePerBlock = _supplyRatePerBlock;
  }

  function _token() internal override view returns (IERC20) {
    return token;
  }

  function _supply(uint256 amount) internal override {
    __accountedBalance = __accountedBalance + amount;
  }

  function _redeem(uint256 amount) internal override {
    __accountedBalance = __accountedBalance - amount;
  }

  function _capture(uint256 amount) internal override {
    __accountedBalance = __accountedBalance + amount;
  }
}
