pragma solidity ^0.6.4;

import "@pooltogether/governor-contracts/contracts/GovernorInterface.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";

contract MockGovernor is GovernorInterface, IERC777Recipient {
  uint256 public override reserveFeeMantissa;
  address public override reserve;

  function setReserveFeeMantissa(uint256 _reserveFeeMantissa) public {
    reserveFeeMantissa = _reserveFeeMantissa;
  }

  function setReserve(address _reserve) public {
    reserve = _reserve;
  }

  function tokensReceived(
    address operator,
    address from,
    address to,
    uint256 amount,
    bytes calldata userData,
    bytes calldata operatorData
  ) external override {
  }

}