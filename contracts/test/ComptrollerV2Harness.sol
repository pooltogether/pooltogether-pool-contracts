pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "../comptroller/ComptrollerV2.sol";

/* solium-disable security/no-block-members */
contract ComptrollerV2Harness is ComptrollerV2 {

  uint32 internal time;

  constructor (
    address _prizeStrategy,
    IERC20Upgradeable _asset,
    IERC20Upgradeable _measure,
    uint256 _dripRatePerSecond
  ) public ComptrollerV2(_prizeStrategy, _asset, _measure, _dripRatePerSecond) {}

  function setCurrentTime(uint32 _time) external {
    time = _time;
  }

  function _currentTime() internal override view returns (uint32) {
    return time;
  }

}