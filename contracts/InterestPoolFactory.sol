pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./InterestPool.sol";
import "./ControlledToken.sol";
import "./ProxyFactory.sol";

contract InterestPoolFactory is Initializable, ProxyFactory {

  event InterestPoolCreated(address indexed interestPool);

  InterestPool public instance;

  function initialize () public initializer {
    instance = new InterestPool();
  }

  function createInterestPool() external returns (InterestPool) {
    InterestPool interestPool = InterestPool(deployMinimal(address(instance), ""));
    emit InterestPoolCreated(address(interestPool));
    return interestPool;
  }
}