pragma solidity ^0.6.4;

import "../periodic-prize-pool/CompoundPeriodicPrizePool.sol";

/* solium-disable security/no-block-members */
contract CompoundPeriodicPrizePoolHarness is CompoundPeriodicPrizePool {

  uint256 time;

  function setPreviousPrizeAverageTickets(uint256 _previousPrizeAverageTickets) external {
    previousPrizeAverageTickets = _previousPrizeAverageTickets;
  }

  function setPreviousPrize(uint256 _previousPrize) external {
    previousPrize = _previousPrize;
  }

  function setCurrentTime(uint256 _time) external {
    time = _time;
  }

  function currentTime() internal override view returns (uint256) {
    if (time == 0) {
      return block.timestamp;
    }
    return time;
  }
}