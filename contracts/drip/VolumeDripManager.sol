pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";

import "../utils/ExtendedSafeCast.sol";
import "../utils/UInt256Array.sol";
import "../utils/MappedSinglyLinkedList.sol";
import "./VolumeDrip.sol";

library VolumeDripManager {
  using SafeMath for uint256;
  using SafeCast for uint256;
  using UInt256Array for uint256[];
  using ExtendedSafeCast for uint256;
  using MappedSinglyLinkedList for MappedSinglyLinkedList.Mapping;
  using VolumeDrip for VolumeDrip.State;

  struct State {
    mapping(address => uint256[]) activeMeasureVolumeDripIndices;
    mapping(uint256 => VolumeDrip.State) volumeDrips;
    mapping(uint256 => address) volumeDripTokens;
    uint256 lastVolumeDripId;
  }

  function addDrip(
    State storage self,
    address measure,
    address dripToken,
    uint32 periodSeconds,
    uint128 dripAmount,
    uint32 startTime
  )
    internal
    returns (uint256 index)
  {
    index = ++self.lastVolumeDripId;
    VolumeDrip.State storage drip = self.volumeDrips[index];
    drip.initialize(periodSeconds, dripAmount, startTime);
    self.activeMeasureVolumeDripIndices[measure].push(index);
    self.volumeDripTokens[index] = dripToken;
  }

  function deactivateDrip(
    State storage self,
    address measure,
    uint256 index
  )
    internal
  {
    (uint256 activeMeasureVolumeDripIndex, bool found) = findActiveMeasureVolumeDripIndex(self, measure, index);
    require(found, "VolumeDripManager/unknown-measure-drip");
    self.activeMeasureVolumeDripIndices[measure].remove(activeMeasureVolumeDripIndex);
  }

  function activateDrip(
    State storage self,
    address measure,
    uint256 index
  )
    internal
    returns (uint256 activeMeasureVolumeDripIndex)
  {
    (, bool found) = findActiveMeasureVolumeDripIndex(self, measure, index);
    require(!found, "VolumeDripManager/drip-active");
    activeMeasureVolumeDripIndex = self.activeMeasureVolumeDripIndices[measure].length;
    self.activeMeasureVolumeDripIndices[measure].push(index);
  }

  function removeDrip(
    State storage self,
    address measure,
    uint256 index
  )
    internal
  {
    (uint256 activeMeasureVolumeDripIndex, bool found) = findActiveMeasureVolumeDripIndex(self, measure, index);
    require(found, "VolumeDripManager/unknown-measure-drip");
    removeDrip(self, measure, index, activeMeasureVolumeDripIndex);
  }

  function findActiveMeasureVolumeDripIndex(
    State storage self,
    address measure,
    uint256 index
  )
    internal
    view
    returns (
      uint256 activeMeasureVolumeDripIndex,
      bool found
    )
  {
    // This for loop may blow up, so have a backup!
    for (uint256 i = 0; i < self.activeMeasureVolumeDripIndices[measure].length; i++) {
      if (self.activeMeasureVolumeDripIndices[measure][i] == index) {
        activeMeasureVolumeDripIndex = i;
        found = true;
        break;
      }
    }
  }

  function removeDrip(
    State storage self,
    address measure,
    uint256 index,
    uint256 activeMeasureVolumeDripIndex
  )
    internal
  {
    require(self.activeMeasureVolumeDripIndices[measure][activeMeasureVolumeDripIndex] == index, "VolumeDripManager/index-mismatch");
    self.activeMeasureVolumeDripIndices[measure].remove(activeMeasureVolumeDripIndex);
    delete self.volumeDripTokens[index];
    delete self.volumeDrips[index].periodSeconds;
    delete self.volumeDrips[index].dripAmount;
    delete self.volumeDrips[index];
  }

  function setDripAmount(State storage self, uint256 index, uint128 dripAmount) internal {
    require(index <= self.lastVolumeDripId, "VolumeDripManager/drip-not-exists");
    self.volumeDrips[index].dripAmount = dripAmount;
  }

  function deposit(
    State storage self,
    address measure,
    address user,
    uint256 amount,
    uint256 currentTime
  )
    internal
  {
    for (uint256 i = 0; i < self.activeMeasureVolumeDripIndices[measure].length; i++) {
      uint256 index = self.activeMeasureVolumeDripIndices[measure][i];
      VolumeDrip.State storage dripState = self.volumeDrips[index];
      dripState.mint(
        user,
        amount,
        currentTime
      );
    }
  }

  function claimDripTokens(
    State storage self,
    uint256 index,
    address user,
    uint256 currentTime
  )
    internal
    returns (address token, uint256 amount)
  {
    VolumeDrip.State storage volumeDrip = self.volumeDrips[index];
    amount = volumeDrip.burnDrip(user, currentTime);
    token = self.volumeDripTokens[index];
  }

  function getDrip(
    State storage self,
    uint256 index
  )
    internal
    view
    returns (
      uint32 periodSeconds,
      uint128 dripAmount,
      address token
    )
  {
    periodSeconds = self.volumeDrips[index].periodSeconds;
    dripAmount = self.volumeDrips[index].dripAmount;
    token = self.volumeDripTokens[index];
  }

}