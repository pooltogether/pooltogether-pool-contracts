pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./PrizeStrategy.sol";
import "../external/openzeppelin/ProxyFactory.sol";

contract PrizeStrategyProxyFactory is Initializable, ProxyFactory {

  PrizeStrategy public instance;

  function initialize () public initializer {
    instance = new PrizeStrategy();
  }

  function create() external returns (PrizeStrategy) {
    return PrizeStrategy(deployMinimal(address(instance), ""));
  }
}