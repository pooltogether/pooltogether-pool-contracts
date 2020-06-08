pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./CreditReserve.sol";
import "../yield-service/YieldServiceInterface.sol";
import "../../external/openzeppelin/ProxyFactory.sol";

contract CreditReserveFactory is Initializable, ProxyFactory {

  CreditReserve public instance;

  function initialize () public initializer {
    instance = new CreditReserve();
  }

  function createCreditReserve() external returns (CreditReserve) {
    return CreditReserve(deployMinimal(address(instance), ""));
  }
}
