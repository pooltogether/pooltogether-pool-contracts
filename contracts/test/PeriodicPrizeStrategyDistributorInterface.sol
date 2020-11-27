pragma solidity >=0.6.0 <0.7.0;

import "../prize-strategy/PeriodicPrizeStrategy.sol";

/* solium-disable security/no-block-members */
interface PeriodicPrizeStrategyDistributorInterface {
  function distribute(uint256 randomNumber) external;
}