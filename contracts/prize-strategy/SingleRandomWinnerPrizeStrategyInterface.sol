pragma solidity ^0.6.4;

import "../periodic-prize-pool/PeriodicPrizePoolInterface.sol";

interface SingleRandomWinnerPrizeStrategyInterface {
  function startAward(PeriodicPrizePoolInterface prizePool) external;
  function completeAward(PeriodicPrizePoolInterface prizePool, bytes calldata data) external;
  function canStartAward(PeriodicPrizePoolInterface prizePool) external view returns (bool);
  function canCompleteAward(PeriodicPrizePoolInterface prizePool) external view returns (bool);
}