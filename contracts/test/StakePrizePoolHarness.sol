pragma solidity >=0.6.0 <0.7.0;

import "../prize-pool/stake/StakePrizePool.sol";

/* solium-disable security/no-block-members */
contract StakePrizePoolHarness is StakePrizePool {

  uint256 public currentTime;

  function setCurrentTime(uint256 _currentTime) external {
    currentTime = _currentTime;
  }

  function _currentTime() internal override view returns (uint256) {
    return currentTime;
  }

  function supply(uint256 mintAmount) external {
    //_supply(mintAmount);
  }

  function redeem(uint256 redeemAmount) external returns (uint256) {
    return redeemAmount;
  }
}