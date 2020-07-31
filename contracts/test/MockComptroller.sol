pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";

import "../comptroller/ComptrollerInterface.sol";

contract MockComptroller is ComptrollerInterface {
  uint256 public override reserveRateMantissa;

  function setReserveFeeMantissa(uint256 _reserveRateMantissa) public {
    reserveRateMantissa = _reserveRateMantissa;
  }

  function afterDepositTo(
    address to,
    uint256 amount,
    uint256 balance,
    uint256 totalSupply,
    address controlledToken,
    address referrer
  )
    external
    override
  {

  }

  function afterWithdrawFrom(
    address to,
    uint256 amount,
    uint256 balance,
    uint256 totalSupply,
    address controlledToken
  )
    external
    override
  {

  }
}