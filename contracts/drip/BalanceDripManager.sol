pragma solidity ^0.6.4;

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

  function updateDrips(
    State storage self,
    address measure,
    address user,
    uint256 measureBalance,
    uint256 measureTotalSupply,
    uint256 currentTime
  ) internal {
    address currentDripToken = self.activeBalanceDrips[measure].addressMap[MappedSinglyLinkedList.SENTINAL];
    while (currentDripToken != address(0) && currentDripToken != MappedSinglyLinkedList.SENTINAL) {
      BalanceDrip.State storage dripState = self.balanceDrips[measure][currentDripToken];
      dripState.drip(
        user,
        measureBalance,
        measureTotalSupply,
        currentTime
      );
      currentDripToken = self.activeBalanceDrips[measure].addressMap[currentDripToken];
    }
  }

  function addDrip(State storage self, address measure, address dripToken, uint256 dripRatePerSecond, uint256 currentTime) internal {
    require(!self.activeBalanceDrips[measure].contains(dripToken), "BalanceDripManager/drip-exists");
    if (self.activeBalanceDrips[measure].count == 0) {
      self.activeBalanceDrips[measure].initialize();
    }
    self.activeBalanceDrips[measure].addAddress(dripToken);
    self.balanceDrips[measure][dripToken].initialize(currentTime);
    self.balanceDrips[measure][dripToken].dripRatePerSecond = dripRatePerSecond;
  }

  function removeDrip(
    State storage self,
    address measure,
    address prevDripToken,
    address dripToken
  )
    internal
  {
    delete self.balanceDrips[measure][dripToken];
    self.activeBalanceDrips[measure].removeAddress(prevDripToken, dripToken);
  }

  function setDripRate(State storage self, address measure, address dripToken, uint256 dripRatePerSecond) internal {
    require(self.activeBalanceDrips[measure].contains(dripToken), "BalanceDripManager/drip-not-exists");
    self.balanceDrips[measure][dripToken].dripRatePerSecond = dripRatePerSecond;
  }

  function hasDrip(State storage self, address measure, address dripToken) internal view returns (bool) {
    return self.activeBalanceDrips[measure].contains(dripToken);
  }

  function getDrip(State storage self, address measure, address dripToken) internal view returns (BalanceDrip.State storage) {
    return self.balanceDrips[measure][dripToken];
  }

  function balanceOfDrip(
    State storage self,
    address user,
    address measure,
    address dripToken
  )
    internal view
    returns (uint256)
  {
    BalanceDrip.State storage dripState = self.balanceDrips[measure][dripToken];
    return dripState.userStates[user].dripBalance;
  }

  function claimDripTokens(State storage self, address user, address measure, address dripToken) internal returns (uint256) {
    BalanceDrip.State storage dripState = self.balanceDrips[measure][dripToken];
    uint256 balance = dripState.userStates[user].dripBalance;
    dripState.burnDrip(user, balance);
    require(IERC20(dripToken).transfer(user, balance), "BalanceDripManager/transfer-failed");
    return balance;
  }
}
