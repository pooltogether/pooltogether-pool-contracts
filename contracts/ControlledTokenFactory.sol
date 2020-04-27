pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./ControlledToken.sol";
import "./ProxyFactory.sol";

contract ControlledTokenFactory is Initializable, ProxyFactory {

  event ControlledTokenCreated(address indexed controlledToken);

  ControlledToken public instance;

  function initialize () public initializer {
    instance = new ControlledToken();
  }

  function createControlledToken() public returns (ControlledToken) {
    ControlledToken controlledToken = ControlledToken(deployMinimal(address(instance), ""));
    emit ControlledTokenCreated(address(controlledToken));
    return controlledToken;
  }

  function createControlledToken(
    string memory _interestName,
    string memory _interestSymbol,
    TokenControllerInterface controller
  ) public returns (ControlledToken) {
    ControlledToken token = createControlledToken();
    token.initialize(
      _interestName,
      _interestSymbol,
      controller
    );
    return token;
  }
}