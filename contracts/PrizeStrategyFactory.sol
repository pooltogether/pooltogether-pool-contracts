pragma solidity ^0.6.4;

import "./SingleRandomWinnerPrizeStrategy.sol";
import "./ControlledToken.sol";
import "./ProxyFactory.sol";

contract PrizeStrategyFactory is ProxyFactory {

  event PrizeStrategyCreated(address indexed prizeStrategy);

  SingleRandomWinnerPrizeStrategy public instance;

  constructor () public {
    instance = new SingleRandomWinnerPrizeStrategy();
  }

  function createSingleRandomWinner() external returns (SingleRandomWinnerPrizeStrategy) {
    SingleRandomWinnerPrizeStrategy prizeStrategy = SingleRandomWinnerPrizeStrategy(deployMinimal(address(instance), ""));
    emit PrizeStrategyCreated(address(prizeStrategy));
    return prizeStrategy;
  }
}