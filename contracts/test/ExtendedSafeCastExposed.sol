pragma solidity 0.6.4;

import "../utils/ExtendedSafeCast.sol";

contract ExtendedSafeCastExposed {
  function toUint112(uint256 value) external pure returns (uint112) {
    return ExtendedSafeCast.toUint112(value);
  }
}