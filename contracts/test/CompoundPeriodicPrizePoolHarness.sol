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

  function _currentTime() internal override view returns (uint256) {
    if (time == 0) {
      return block.timestamp;
    }
    return time;
  }

  function setInterestSharesForTest(address user, uint256 amount) external {
    ticketInterestShares[user] = amount;
  }

  function setSponsorshipInterestSharesForTest(address user, uint256 amount) external {
    sponsorshipInterestShares[user] = amount;
  }

  // Here we mint a user "fair shares" of the total pool of collateral.
  function supplyCollateralForTest(uint256 _collateral) public {
    uint256 shares = FixedPoint.divideUintByMantissa(_collateral, _exchangeRateMantissa());
    interestShareTotalSupply = interestShareTotalSupply.add(shares);
    totalCollateral = totalCollateral.add(_collateral);
    __accountedBalance = __accountedBalance.add(_collateral);
  }
}