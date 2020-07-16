pragma solidity ^0.6.4;

import "../rng/RNGInterface.sol";

contract RNGServiceMock is RNGInterface {

  uint256 internal random;

  function setRandomNumber(uint256 rando) external {
    random = rando;
  }

  function requestRandomNumber(address, uint256) external override returns (uint32, uint32) {
    return (1, 1);
  }

  function isRequestComplete(uint32) external override view returns (bool) {
    return true;
  }

  function randomNumber(uint32) external override view returns (uint256) {
    return random;
  }
}