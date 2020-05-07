pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "../external/compound/CTokenInterface.sol";
import "../token/ControlledTokenFactory.sol";
import "./CompoundYieldServiceFactory.sol";

contract CompoundYieldServiceBuilder is Initializable {

  CompoundYieldServiceFactory public compoundYieldServiceFactory;
  ControlledTokenFactory public controlledTokenFactory;

  event CompoundYieldServiceBuilt(address indexed creator, address indexed compoundYieldService, address indexed cToken);

  function initialize (
    CompoundYieldServiceFactory _compoundYieldServiceFactory
  ) public initializer {
    require(address(_compoundYieldServiceFactory) != address(0), "compound interest pool factory must be defined");
    compoundYieldServiceFactory = _compoundYieldServiceFactory;
  }

  function createCompoundYieldService(
    CTokenInterface cToken
  ) external returns (CompoundYieldService) {
    CompoundYieldService yieldService = compoundYieldServiceFactory.createCompoundYieldService();
    yieldService.initialize(cToken);

    emit CompoundYieldServiceBuilt(msg.sender, address(yieldService), address(cToken));

    return yieldService;
  }
}
