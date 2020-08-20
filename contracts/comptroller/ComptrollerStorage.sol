pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";

import "../drip/BalanceDripManager.sol";
import "../drip/VolumeDrip.sol";

contract ComptrollerStorage is OwnableUpgradeSafe {
  uint256 internal _reserveRateMantissa;

  uint256 internal lastVolumeDripId;
  mapping(uint256 => VolumeDrip.State) internal volumeDrips;
  mapping(uint256 => address) internal volumeDripTokens;

  struct PrizeStrategyVolumeDripManager {
    mapping(address => uint256[]) activeMeasureVolumeDripIndices;
    mapping(address => uint256[]) activeMeasureReferralVolumeDripIndices;
  }

  mapping(address => PrizeStrategyVolumeDripManager) internal prizeStrategyVolumeDripManagers;
  mapping(address => BalanceDripManager.State) internal balanceDrips;

  mapping(address => mapping(address => uint256)) internal dripTokenBalances;
}