pragma solidity ^0.6.4;

import "../drip/VolumeDripManager.sol";

contract VolumeDripManagerExposed {
  using VolumeDripManager for VolumeDripManager.State;

  VolumeDripManager.State state;

  event DripTokensClaimed(
    uint256 index,
    address user,
    address dripToken,
    uint256 amount
  );

  function addDrip(
    address measure,
    address dripToken,
    uint32 periodSeconds,
    uint128 dripAmount,
    uint32 currentTime
  )
    external
  {
    state.addDrip(measure, dripToken, periodSeconds, dripAmount, currentTime);
  }

  function removeDrip(
    address measure,
    uint256 index
  )
    external
  {
    state.removeDrip(measure, index);
  }

  function setDripAmount(uint256 index, uint128 dripAmount) external {
    state.setDripAmount(index, dripAmount);
  }

  function deposit(
    address measure,
    address user,
    uint256 amount,
    uint256 currentTime
  )
    external
  {
    state.deposit(measure, user, amount, currentTime);
  }

  function claimDripTokens(
    uint256 index,
    address user,
    uint256 currentTime
  )
    external
    returns (uint256)
  {
    (address token, uint256 amount) = state.claimDripTokens(index, user, currentTime);

    emit DripTokensClaimed(
      index,
      user,
      token,
      amount
    );
  }

  function getDrip(
    uint256 index
  )
    external
    view
    returns (
      uint32 periodSeconds,
      uint128 dripAmount,
      address token
    )
  {
    return state.getDrip(index);
  }

  function getPeriod(uint256 index, uint256 periodIndex)
    external
    view
    returns (
      uint224 totalSupply,
      uint32 startTime
    )
  {
    totalSupply = state.volumeDrips[index].periods[periodIndex].totalSupply;
    startTime = state.volumeDrips[index].periods[periodIndex].startTime;
  }

  function getDeposit(uint256 index, address user)
    external
    view
    returns (
      uint112 balance,
      uint16 period,
      uint128 accrued
    )
  {
    balance = state.volumeDrips[index].deposits[user].balance;
    period = state.volumeDrips[index].deposits[user].period;
    accrued = state.volumeDrips[index].deposits[user].accrued;
  }

  function deactivateDrip(
    address measure,
    uint256 index
  ) external {
    state.deactivateDrip(measure, index);
  }

  function activateDrip(
    address measure,
    uint256 index
  ) external {
    state.activateDrip(measure, index);
  }

}
