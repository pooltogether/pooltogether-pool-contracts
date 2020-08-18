pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";

import "../drip/BalanceDripManager.sol";
import "../drip/VolumeDripManager.sol";

contract ComptrollerStorage is OwnableUpgradeSafe {
  uint256 internal _reserveRateMantissa;

  mapping(address => VolumeDripManager.State) internal referralVolumeDrips;
  mapping(address => VolumeDripManager.State) internal volumeDrips;
  mapping(address => BalanceDripManager.State) internal balanceDrips;
}