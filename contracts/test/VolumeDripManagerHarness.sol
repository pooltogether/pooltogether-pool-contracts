pragma solidity ^0.6.4;

import "../drip/VolumeDripManager.sol";

contract VolumeDripManagerHarness is VolumeDripManager {

  uint256 internal time;

  function setCurrentTime(uint256 _time) external {
    time = _time;
  }

  function _currentTime() internal override view returns (uint256) {
    return time;
  }

}
