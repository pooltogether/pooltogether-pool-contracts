pragma solidity ^0.6.4;

import "@nomiclabs/buidler/console.sol";

import "../drip/BalanceDripManager.sol";

contract BalanceDripManagerExposed {
  using BalanceDripManager for BalanceDripManager.State;

  BalanceDripManager.State dripManager;

  function updateDrips(
    address measure,
    address user,
    uint256 measureBalance,
    uint256 measureTotalSupply,
    uint256 currentTime
  ) external {
    dripManager.updateDrips(measure, user, measureBalance, measureTotalSupply, currentTime);
  }

  function addDrip(address measure, address dripToken, uint256 dripRatePerSecond, uint256 currentTime) external {
    dripManager.addDrip(measure, dripToken, dripRatePerSecond, currentTime);
  }

  function hasDrip(address measure, address dripToken) external view returns (bool) {
    return dripManager.hasDrip(measure, dripToken);
  }

  function setDripRate(address measure, address dripToken, uint256 dripRatePerSecond) external {
    dripManager.setDripRate(measure, dripToken, dripRatePerSecond);
  }

  function balanceOfDrip(address user, address measure, address dripToken) external view returns (uint256) {
    return dripManager.balanceOfDrip(user, measure, dripToken);
  }

  function getDrip(
    address measure,
    address dripToken
  )
    external
    view
    returns (
      uint256 dripRatePerSecond,
      uint128 exchangeRateMantissa,
      uint32 timestamp
    )
  {
    BalanceDrip.State storage dripState = dripManager.getDrip(measure, dripToken);
    dripRatePerSecond = dripState.dripRatePerSecond;
    exchangeRateMantissa = dripState.exchangeRateMantissa;
    timestamp = dripState.timestamp;
  }

  function claimDripTokens(address user, address measure, address dripToken) external {
    dripManager.claimDripTokens(user, measure, dripToken);
  }
}
