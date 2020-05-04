pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./compound/CTokenInterface.sol";
import "./ControlledTokenFactory.sol";
import "./CompoundInterestPoolFactory.sol";

contract CompoundInterestPoolBuilder is Initializable {

  CompoundInterestPoolFactory public compoundInterestPoolFactory;
  ControlledTokenFactory public controlledTokenFactory;

  event CompoundInterestPoolBuilt(address indexed creator, address indexed compoundInterestPool, address indexed cToken);

  function initialize (
    CompoundInterestPoolFactory _compoundInterestPoolFactory
  ) public initializer {
    require(address(_compoundInterestPoolFactory) != address(0), "compound interest pool factory must be defined");
    compoundInterestPoolFactory = _compoundInterestPoolFactory;
  }

  function createCompoundInterestPool(
    CTokenInterface cToken
  ) external returns (CompoundInterestPool) {
    CompoundInterestPool interestPool = compoundInterestPoolFactory.createCompoundInterestPool();
    interestPool.initialize(cToken);

    emit CompoundInterestPoolBuilt(msg.sender, address(interestPool), address(cToken));

    return interestPool;
  }
}
