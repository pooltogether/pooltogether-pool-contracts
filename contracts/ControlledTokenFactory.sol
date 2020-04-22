pragma solidity ^0.6.4;

import "./ControlledToken.sol";

contract ControlledTokenFactory {

  event ControlledTokenCreated(address indexed controlledToken);

  function createControlledToken() public returns (ControlledToken) {
    ControlledToken controlledToken = new ControlledToken();
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