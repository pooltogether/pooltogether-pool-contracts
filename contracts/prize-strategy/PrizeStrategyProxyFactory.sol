pragma solidity 0.6.4;

import "./PrizeStrategy.sol";
import "../external/openzeppelin/ProxyFactory.sol";

contract PrizeStrategyProxyFactory is ProxyFactory {

  PrizeStrategy public instance;

  constructor () public {
    instance = new PrizeStrategy();
  }

  function create() external returns (PrizeStrategy) {
    return PrizeStrategy(deployMinimal(address(instance), ""));
  }
}