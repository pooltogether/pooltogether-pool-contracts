pragma solidity ^0.6.4;

import "../drip/VolumeDrip.sol";

contract VolumeDripExposed {
  using VolumeDrip for VolumeDrip.State;

  event DripTokensBurned(address user, uint256 amount);
  event Minted(uint256 amount, bool isNewPeriod);

  VolumeDrip.State state;

  function setNewPeriod(uint32 periodSeconds, uint112 dripAmount, uint32 endTime) external {
    state.setNewPeriod(periodSeconds, dripAmount, endTime);
  }

  function setNextPeriod(uint32 periodSeconds, uint112 dripAmount) external {
    state.setNextPeriod(periodSeconds, dripAmount);
  }

  function poke(uint256 currentTime) external returns (bool) {
    return state.poke(currentTime);
  }

  function mint(address user, uint256 amount, uint256 currentTime) external returns (uint256 accrued, bool isNewPeriod) {
    (accrued, isNewPeriod) = state.mint(user, amount, currentTime);

    emit Minted(accrued, isNewPeriod);

    return (accrued, isNewPeriod);
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

  function getPeriod(uint32 period)
    external
    view
    returns (
      uint112 totalSupply,
      uint112 dripAmount,
      uint32 endTime
    )
  {
    totalSupply = state.periods[period].totalSupply;
    endTime = state.periods[period].endTime;
    dripAmount = state.periods[period].dripAmount;
  }

  function getDeposit(address user)
    external
    view
    returns (
      uint112 balance,
      uint32 period
    )
  {
    balance = state.deposits[user].balance;
    period = state.deposits[user].period;
  }

}
