pragma solidity ^0.5.10;

import "./UniformRandomNumber.sol";

contract ExposedUniformRandomNumber {
  function uniform(uint256 _entropy, uint256 _upperBound) public pure returns (uint256) {
    return UniformRandomNumber.uniform(_entropy, _upperBound);
  }
}