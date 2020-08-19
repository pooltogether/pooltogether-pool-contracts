pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

import "../utils/MappedSinglyLinkedList.sol";
import "./VolumeDrip.sol";

library VolumeDripManager {
  using SafeMath for uint256;
  using MappedSinglyLinkedList for MappedSinglyLinkedList.Mapping;
  using VolumeDrip for VolumeDrip.State;

  struct State {
    mapping(address => MappedSinglyLinkedList.Mapping) activeVolumeDrips;
    mapping(address => mapping(address => VolumeDrip.State)) volumeDrips;
  }

  function activate(
    State storage self,
    address measure,
    address dripToken,
    uint32 periodSeconds,
    uint112 dripAmount,
    uint32 endTime
  )
    internal
  {
    require(!self.activeVolumeDrips[measure].contains(dripToken), "VolumeDripManager/drip-active");
    if (self.activeVolumeDrips[measure].count == 0) {
      address[] memory single = new address[](1);
      single[0] = dripToken;
      self.activeVolumeDrips[measure].initialize(single);
    } else {
      self.activeVolumeDrips[measure].addAddress(dripToken);
    }
    self.volumeDrips[measure][dripToken].setNewPeriod(periodSeconds, dripAmount, endTime);
  }

  function deactivate(
    State storage self,
    address measure,
    address dripToken,
    address prevDripToken
  )
    internal
  {
    self.activeVolumeDrips[measure].removeAddress(prevDripToken, dripToken);
  }

  function set(State storage self, address measure, address dripToken, uint32 periodSeconds, uint112 dripAmount) internal {
    require(self.activeVolumeDrips[measure].contains(dripToken), "VolumeDripManager/drip-not-active");
    self.volumeDrips[measure][dripToken].setNextPeriod(periodSeconds, dripAmount);
  }

  function isActive(State storage self, address measure, address dripToken) internal view returns (bool) {
    return self.activeVolumeDrips[measure].contains(dripToken);
  }

  function getDrip(State storage self, address measure, address dripToken) internal view returns (VolumeDrip.State storage) {
    return self.volumeDrips[measure][dripToken];
  }
}
