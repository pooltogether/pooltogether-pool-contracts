pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./SingleRandomWinnerPrizeStrategy.sol";
import "../token/ControlledToken.sol";
import "../external/openzeppelin/ProxyFactory.sol";

contract SingleRandomWinnerPrizeStrategyFactory is Initializable, ProxyFactory {

  SingleRandomWinnerPrizeStrategy public instance;

  function initialize () public initializer {
    instance = new SingleRandomWinnerPrizeStrategy();
  }

  function createSingleRandomWinner() external returns (SingleRandomWinnerPrizeStrategy) {
    return SingleRandomWinnerPrizeStrategy(deployMinimal(address(instance), ""));
  }
}