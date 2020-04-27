pragma solidity ^0.6.4;

import "./InterestPool.sol";
import "./ControlledToken.sol";
import "./ProxyFactory.sol";

contract InterestPoolFactory is ProxyFactory {

  event InterestPoolCreated(address indexed interestPool);

  InterestPool public instance;

  constructor () public {
    instance = new InterestPool();
  }

  function createInterestPool() external returns (InterestPool) {
    InterestPool interestPool = InterestPool(deployMinimal(address(instance), ""));
    emit InterestPoolCreated(address(interestPool));
    return interestPool;
  }
}