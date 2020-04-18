pragma solidity ^0.6.4;

import "./InterestPool.sol";
import "./ControlledToken.sol";
import "./compound/ICToken.sol";

contract InterestPoolFactory {
  function createInterestPool(
    ICToken _cToken,
    ControlledToken _collateralTokens,
    address _allocator
  ) external returns (InterestPool) {
    InterestPool ip = new InterestPool();
    ip.initialize(_cToken, _collateralTokens, _allocator);
    return ip;
  }
}