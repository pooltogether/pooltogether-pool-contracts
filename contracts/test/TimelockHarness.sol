pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "../periodic-prize-pool/Timelock.sol";

contract TimelockHarness is Timelock {
  using SafeMath for uint256;
  
  address public cToken;
  uint256 internal tokenBalance;
  uint256 internal override __accountedBalance;

  function setTokenAddressForTest(address _cToken) public {
    cToken = _cToken;
  }

  function setTokenBalanceForTest(uint256 _tokenBalance) public {
    tokenBalance = _tokenBalance;
    __accountedBalance = _tokenBalance;
  }

  function _balance() internal override returns (uint256) {
    return tokenBalance;
  }

  function _accountedBalance() internal override view returns (uint256) {
    return __accountedBalance;
  }

  function _unaccountedBalance() internal override returns (uint256) {
    uint256 underlying = tokenBalance;
    if (underlying >= __accountedBalance) {
      return underlying.sub(__accountedBalance);
    } else {
      return 0;
    }
  }

  function _supply(uint256 amount) internal override {
    tokenBalance = tokenBalance.add(amount);
    __accountedBalance = __accountedBalance.add(amount);
  }

  function _redeem(uint256 amount) internal override {
    tokenBalance = tokenBalance.sub(amount);
    __accountedBalance = __accountedBalance.sub(amount);
  }

  function _capture(uint256 amount) internal override {
    require(amount <= _unaccountedBalance(), "Timelock/insuff");
    __accountedBalance = __accountedBalance.add(amount);
  }

  function _estimateAccruedInterestOverBlocks(uint256 principalAmount, uint256 blocks) internal view override returns (uint256) {
    // estimated = principalAmount * supply rate per block * blocks
    uint256 multiplier = principalAmount.mul(blocks);
    return FixedPoint.multiplyUintByMantissa(multiplier, supplyRatePerBlock());
  }

  function supplyRatePerBlock() internal pure returns (uint256) {
    return uint256(1);
  }

  function _token() internal override view returns (IERC20) {
    return IERC20(cToken);
  }

}
