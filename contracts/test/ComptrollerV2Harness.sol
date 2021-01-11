pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "../comptroller/ComptrollerV2.sol";

/* solium-disable security/no-block-members */
contract ComptrollerV2Harness is ComptrollerV2 {

  uint32 internal time;

  function setCurrentTime(uint32 _time) external {
    time = _time;
  }

  function _currentTime() internal override view returns (uint32) {
    return time;
  }

}