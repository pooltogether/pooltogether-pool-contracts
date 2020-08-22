pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

abstract contract DripManager {

  struct DrippedToken {
    address user;
    address token;
    uint256 amount;
  }

  function beforeMeasureTokenTransfer(
    address from,
    address to,
    uint256 amount,
    address measure,
    address referrer
  ) external virtual returns (DrippedToken[] memory);

  function update(
    address to,
    address measure
  ) external virtual returns (DrippedToken[] memory);

}