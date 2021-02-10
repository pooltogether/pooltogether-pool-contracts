pragma solidity >=0.6.0 <0.7.0;

import "../prize-strategy/PeriodicPrizeStrategyListener.sol";

/* solium-disable security/no-block-members */
contract PeriodicPrizeStrategyListenerStub is PeriodicPrizeStrategyListener {

  event Awarded();

  function afterPrizePoolAwarded(uint256 randomNumber, uint256 prizePeriodStartedAt) external override {
    emit Awarded();
  }
}