pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./Timelock.sol";
import "../../external/openzeppelin/ProxyFactory.sol";

contract TimelockFactory is Initializable, ProxyFactory {

  Timelock public instance;

  function initialize () public initializer {
    instance = new Timelock();
  }

  function createTimelock() public returns (Timelock) {
    return Timelock(deployMinimal(address(instance), ""));
  }
}