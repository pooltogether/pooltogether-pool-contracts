pragma solidity ^0.6.4;

import "../rng/RNGInterface.sol";

contract RNGServiceMock is RNGInterface {

  bytes32 internal random;

  function setRandomNumber(bytes32 rando) external {
    random = rando;
  }

  function requestRandomNumber(address, uint256) external override returns (uint256) {
    return 1;
  }

  function isRequestComplete(uint256) external override view returns (bool) {
    return true;
  }

  function randomNumber(uint256) external override view returns (bytes32) {
    return random;
  }
}