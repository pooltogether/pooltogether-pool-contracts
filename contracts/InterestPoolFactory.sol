pragma solidity ^0.6.4;

import "./InterestPool.sol";
import "./ControlledToken.sol";
import "./compound/ICToken.sol";

contract InterestPoolFactory {

  event InterestPoolCreated(address indexed interestPool);

  function createInterestPool(
    ICToken _cToken,
    ControlledToken _collateralTokens,
    address _allocator
  ) external returns (InterestPool) {
    InterestPool interestPool = new InterestPool();
    interestPool.initialize(_cToken, _collateralTokens, _allocator);
    emit InterestPoolCreated(address(interestPool));
    return interestPool;
  }
}