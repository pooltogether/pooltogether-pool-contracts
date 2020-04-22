pragma solidity ^0.6.4;

import "./SingleRandomWinnerPrizeStrategy.sol";
import "./ControlledToken.sol";
import "./compound/ICToken.sol";

contract PrizeStrategyFactory {

  event PrizeStrategyCreated(address indexed prizeStrategy);

  function createSingleRandomWinner() external returns (SingleRandomWinnerPrizeStrategy) {
    SingleRandomWinnerPrizeStrategy prizeStrategy = new SingleRandomWinnerPrizeStrategy();
    emit PrizeStrategyCreated(address(prizeStrategy));
    return prizeStrategy;
  }
}