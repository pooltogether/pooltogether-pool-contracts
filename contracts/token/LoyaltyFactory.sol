pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./Loyalty.sol";
import "../external/openzeppelin/ProxyFactory.sol";

contract LoyaltyFactory is Initializable, ProxyFactory {

  event LoyaltyCreated(address indexed controlledToken);

  Loyalty public instance;

  function initialize () public initializer {
    instance = new Loyalty();
  }

  function createLoyalty() public returns (Loyalty) {
    Loyalty controlledToken = Loyalty(deployMinimal(address(instance), ""));
    emit LoyaltyCreated(address(controlledToken));
    return controlledToken;
  }

  function createLoyalty(
    string memory _name,
    string memory _symbol,
    address _trustedForwarder
  ) public returns (Loyalty) {
    Loyalty token = createLoyalty();
    token.initialize(
      _name,
      _symbol,
      _trustedForwarder
    );
    token.transferOwnership(msg.sender);
    return token;
  }
}