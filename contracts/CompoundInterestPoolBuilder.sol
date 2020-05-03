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
    CompoundInterestPoolFactory _compoundInterestPoolFactory,
    ControlledTokenFactory _controlledTokenFactory
  ) public initializer {
    require(address(_compoundInterestPoolFactory) != address(0), "compound interest pool factory must be defined");
    require(address(_controlledTokenFactory) != address(0), "controlledTokenFactory must be defined");
    compoundInterestPoolFactory = _compoundInterestPoolFactory;
    controlledTokenFactory = _controlledTokenFactory;
  }

  function createCompoundInterestPool(
    CTokenInterface cToken
  ) external returns (CompoundInterestPool) {
    CompoundInterestPool interestPool = compoundInterestPoolFactory.createCompoundInterestPool();
    ControlledToken collateral = controlledTokenFactory.createControlledToken();
    collateral.initialize(interestPool);
    interestPool.initialize(cToken, collateral);

    emit CompoundInterestPoolBuilt(msg.sender, address(interestPool), address(cToken));

    return interestPool;
  }
}
