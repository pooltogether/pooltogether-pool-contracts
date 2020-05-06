pragma solidity ^0.6.4;

import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

contract GovernanceFee {
  uint256 public feeFractionMantissa;
  address public feeTo;

  function calculateFee(uint256 totalInterestAccrued) public view returns (uint256) {
    uint256 fee;
    if (feeTo != address(0) && feeFractionMantissa > 0 && totalInterestAccrued > 0) {
      fee = FixedPoint.multiplyUintByMantissa(totalInterestAccrued, feeFractionMantissa);
    }
    return fee;
  }
}