pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./CompoundInterestPool.sol";
import "./ControlledToken.sol";
import "./ProxyFactory.sol";

contract CompoundInterestPoolFactory is Initializable, ProxyFactory {

  event CompoundInterestPoolCreated(address indexed interestPool);

  CompoundInterestPool public instance;

  function initialize () public initializer {
    instance = new CompoundInterestPool();
  }

  function createCompoundInterestPool() external returns (CompoundInterestPool) {
    CompoundInterestPool interestPool = CompoundInterestPool(deployMinimal(address(instance), ""));
    emit CompoundInterestPoolCreated(address(interestPool));
    return interestPool;
  }
}