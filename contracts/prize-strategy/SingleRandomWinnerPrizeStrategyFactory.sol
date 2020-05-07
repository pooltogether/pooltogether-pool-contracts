pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./SingleRandomWinnerPrizeStrategy.sol";
import "../token/ControlledToken.sol";
import "../external/openzeppelin/ProxyFactory.sol";

contract SingleRandomWinnerPrizeStrategyFactory is Initializable, ProxyFactory {

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