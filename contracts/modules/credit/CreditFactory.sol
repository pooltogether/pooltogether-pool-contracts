pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./Credit.sol";
import "../yield-service/YieldServiceInterface.sol";
import "../../external/openzeppelin/ProxyFactory.sol";

contract CreditFactory is Initializable, ProxyFactory {

  Credit public instance;

  function initialize () public initializer {
    instance = new Credit();
  }

  function createCredit() external returns (Credit) {
    return Credit(deployMinimal(address(instance), ""));
  }
}
