pragma solidity ^0.6.4;

import "./InterestPool.sol";
import "./ControlledToken.sol";
import "./InterestToken.sol";

contract InterestPoolFactory {

  event InterestPoolCreated(address indexed interestPool);

  function createInterestPool() external returns (InterestPool) {
    InterestPool interestPool = new InterestPool();
    emit InterestPoolCreated(address(interestPool));
    return interestPool;
  }
}