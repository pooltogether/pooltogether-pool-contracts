pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./SingleRandomWinnerPrizeStrategy.sol";
import "./ControlledToken.sol";
import "./ProxyFactory.sol";

contract PrizeStrategyFactory is Initializable, ProxyFactory {

  event PrizeStrategyCreated(address indexed prizeStrategy);

  SingleRandomWinnerPrizeStrategy public instance;

  function initialize () public initializer {
    instance = new SingleRandomWinnerPrizeStrategy();
  }

  function createSingleRandomWinner() external returns (SingleRandomWinnerPrizeStrategy) {
    SingleRandomWinnerPrizeStrategy prizeStrategy = SingleRandomWinnerPrizeStrategy(deployMinimal(address(instance), ""));
    emit PrizeStrategyCreated(address(prizeStrategy));
    return prizeStrategy;
  }
}