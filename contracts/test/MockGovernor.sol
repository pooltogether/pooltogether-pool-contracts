pragma solidity ^0.6.4;

import "@pooltogether/governor-contracts/contracts/GovernorInterface.sol";

contract MockGovernor is GovernorInterface {
  uint256 public override reserveFeeMantissa;
  address public override reserve;

  function setReserveFeeMantissa(uint256 _reserveFeeMantissa) public {
    reserveFeeMantissa = _reserveFeeMantissa;
  }

  function setReserve(address _reserve) public {
    reserve = _reserve;
  }
}