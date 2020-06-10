pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./InterestTracker.sol";
import "../../external/openzeppelin/ProxyFactory.sol";

contract InterestTrackerFactory is Initializable, ProxyFactory {

  InterestTracker public instance;

  function initialize () public initializer {
    instance = new InterestTracker();
  }

  function createInterestTracker() public returns (InterestTracker) {
    return InterestTracker(deployMinimal(address(instance), ""));
  }
}