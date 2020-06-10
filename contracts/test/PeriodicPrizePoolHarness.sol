pragma solidity ^0.6.4;

import "../modules/periodic-prize-pool/PeriodicPrizePool.sol";

contract PeriodicPrizePoolHarness is PeriodicPrizePool {

  function calculateExitFeeWithValues(
    uint256 _userInterestRatioMantissa,
    uint256 _tickets,
    uint256 _previousPrizeAverageTickets,
    uint256 _previousPrize
  ) public pure returns (uint256) {
    return _calculateExitFeeWithValues(
      _userInterestRatioMantissa,
      _tickets,
      _previousPrizeAverageTickets,
      _previousPrize
    );
  }

  function setPreviousPrizeAverageTickets(uint256 _previousPrizeAverageTickets) external {
    previousPrizeAverageTickets = _previousPrizeAverageTickets;
  }

  function setPreviousPrize(uint256 _previousPrize) external {
    previousPrize = _previousPrize;
  }

}