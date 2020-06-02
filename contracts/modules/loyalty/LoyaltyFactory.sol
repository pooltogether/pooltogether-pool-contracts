pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./Loyalty.sol";
import "../../external/openzeppelin/ProxyFactory.sol";

contract LoyaltyFactory is Initializable, ProxyFactory {

  event LoyaltyCreated(address indexed controlledToken);

  Loyalty public instance;

  function initialize () public initializer {
    instance = new Loyalty();
  }

  function createLoyalty() public returns (Loyalty) {
    return Loyalty(deployMinimal(address(instance), ""));
  }
}