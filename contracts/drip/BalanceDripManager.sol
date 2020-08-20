pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

import "../utils/MappedSinglyLinkedList.sol";
import "./BalanceDrip.sol";

library BalanceDripManager {
  using SafeMath for uint256;
  using MappedSinglyLinkedList for MappedSinglyLinkedList.Mapping;
  using BalanceDrip for BalanceDrip.State;

  struct State {
    mapping(address => MappedSinglyLinkedList.Mapping) activeBalanceDrips;
    mapping(address => mapping(address => BalanceDrip.State)) balanceDrips;
  }

  function activateDrip(
    State storage self,
    address measure,
    address dripToken,
    uint256 dripRatePerSecond,
    uint32 currentTime
  )
    internal
  {
    require(!self.activeBalanceDrips[measure].contains(dripToken), "BalanceDripManager/drip-active");
    if (self.activeBalanceDrips[measure].count == 0) {
      self.activeBalanceDrips[measure].initialize();
    }
    self.activeBalanceDrips[measure].addAddress(dripToken);
    self.balanceDrips[measure][dripToken].setDripRate(IERC20(measure).totalSupply(), dripRatePerSecond, currentTime);
  }

  function deactivateDrip(
    State storage self,
    address measure,
    address dripToken,
    address prevDripToken,
    uint32 currentTime
  )
    internal
  {
    self.activeBalanceDrips[measure].removeAddress(prevDripToken, dripToken);
    self.balanceDrips[measure][dripToken].setDripRate(IERC20(measure).totalSupply(), 0, currentTime);
  }

  function setDripRate(State storage self, address measure, address dripToken, uint256 dripRatePerSecond, uint32 currentTime) internal {
    require(self.activeBalanceDrips[measure].contains(dripToken), "BalanceDripManager/drip-not-active");
    self.balanceDrips[measure][dripToken].setDripRate(IERC20(measure).totalSupply(), dripRatePerSecond, currentTime);
  }

  function isDripActive(State storage self, address measure, address dripToken) internal view returns (bool) {
    return self.activeBalanceDrips[measure].contains(dripToken);
  }

  function getDrip(State storage self, address measure, address dripToken) internal view returns (BalanceDrip.State storage) {
    return self.balanceDrips[measure][dripToken];
  }
}
