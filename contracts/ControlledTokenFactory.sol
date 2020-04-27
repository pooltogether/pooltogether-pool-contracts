pragma solidity ^0.6.4;

import "./ControlledToken.sol";
import "./ProxyFactory.sol";

contract ControlledTokenFactory is ProxyFactory {

  event ControlledTokenCreated(address indexed controlledToken);

  ControlledToken public instance;

  constructor () public {
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