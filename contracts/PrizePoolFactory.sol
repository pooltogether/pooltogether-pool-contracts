pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./PrizePool.sol";
import "./InterestPoolInterface.sol";
import "./ControlledToken.sol";
import "./ProxyFactory.sol";

contract PrizePoolFactory is Initializable, ProxyFactory {

  event PrizePoolCreated(address indexed prizePool);

  PrizePool public instance;

  function initialize () public initializer {
    instance = new PrizePool();
  }

  function createPrizePool() external returns (PrizePool) {
    PrizePool prizePool = PrizePool(deployMinimal(address(instance), ""));
    emit PrizePoolCreated(address(prizePool));
    return prizePool;
  }
}