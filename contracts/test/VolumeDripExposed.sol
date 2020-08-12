pragma solidity ^0.6.4;

import "../drip/VolumeDrip.sol";

contract VolumeDripExposed {
  using VolumeDrip for VolumeDrip.State;

  event DripTokensBurned(address user, uint256 amount);

  VolumeDrip.State state;

  function initialize(uint32 periodSeconds, uint128 dripAmount, uint32 startTime) external {
    state.initialize(periodSeconds, dripAmount, startTime);
  }

  function isPeriodOver(uint256 currentTime) external view returns (bool) {
    return state.isPeriodOver(currentTime);
  }

  function completePeriod(uint256 currentTime) external {
    state.completePeriod(currentTime);
  }

  function mint(address user, uint256 amount, uint256 currentTime) external {
    state.mint(user, amount, currentTime);
  }

  function calculateAccrued(
    uint16 depositPeriod,
    uint128 balance
  ) external view returns (uint256) {
    return state.calculateAccrued(depositPeriod, balance);
  }

  function burnDrip(address user) external {
    uint256 amount = state.burnDrip(user);
    emit DripTokensBurned(user, amount);
  }

  function balanceOf(
    address user
  )
    external view
    returns (uint256 accrued)
  {
    accrued = state.balanceOf(user).accrued;
  }

  function getDrip()
    external
    view
    returns (
      uint32 periodSeconds,
      uint128 dripAmount
    )
  {
    periodSeconds = state.periodSeconds;
    dripAmount = state.dripAmount;
  }

  function getPeriod(uint16 index)
    external
    view
    returns (
      uint224 totalSupply,
      uint32 startTime
    )
  {
    totalSupply = state.periods[index].totalSupply;
    startTime = state.periods[index].startTime;
  }

  function getDeposit(address user)
    external
    view
    returns (
      uint112 balance,
      uint16 period,
      uint128 accrued
    )
  {
    balance = state.deposits[user].balance;
    period = state.deposits[user].period;
    accrued = state.deposits[user].accrued;
  }

}
