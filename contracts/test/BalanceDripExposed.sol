pragma solidity ^0.6.4;

import "../drip/BalanceDrip.sol";

contract BalanceDripExposed {
  using BalanceDrip for BalanceDrip.State;

  BalanceDrip.State internal dripState;

  function initialize(
    uint256 dripRatePerSecond,
    uint256 currentTime
  ) external {
    dripState.initialize(currentTime);
    dripState.dripRatePerSecond = dripRatePerSecond;
  }

  function drip(
    address user,
    uint256 userMeasureBalance,
    uint256 measureTotalSupply,
    uint256 currentTime
  ) external {
    dripState.drip(
      user,
      userMeasureBalance,
      measureTotalSupply,
      currentTime
    );
  }

  function burnDrip(
    address user,
    uint256 amount
  ) external {
    dripState.burnDrip(user, amount);
  }

  function balanceOf(address user) external view returns (uint256) {
    return dripState.userStates[user].dripBalance;
  }

  function exchangeRateMantissa() external view returns (uint256) {
    return dripState.exchangeRateMantissa;
  }
}