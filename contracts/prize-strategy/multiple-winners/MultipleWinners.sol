// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import "../PeriodicPrizeStrategy.sol";

contract MultipleWinners is PeriodicPrizeStrategy {

  uint256 internal __numberOfWinners;

  event NumberOfWinnersSet(uint256 numberOfWinners);

  event NoWinners();

  function initializeMultipleWinners (
    address _trustedForwarder,
    uint256 _prizePeriodStart,
    uint256 _prizePeriodSeconds,
    PrizePool _prizePool,
    address _ticket,
    address _sponsorship,
    RNGInterface _rng,
    uint256 _numberOfWinners
  ) public initializer {
    PeriodicPrizeStrategy.initialize(
      _trustedForwarder,
      _prizePeriodStart,
      _prizePeriodSeconds,
      _prizePool,
      _ticket,
      _sponsorship,
      _rng
    );
    require(_numberOfWinners > 0, "MultipleWinners/num-gt-zero");
    __numberOfWinners = _numberOfWinners;
  }

  function setNumberOfWinners(uint256 count) external onlyOwner {
    __numberOfWinners = count;

    emit NumberOfWinnersSet(count);
  }

  function numberOfWinners() external view returns (uint256) {
    return __numberOfWinners;
  }

  function _distribute(uint256 randomNumber) internal override {
    uint256 prize = prizePool.captureAwardBalance();

    // main winner gets all external tokens
    address mainWinner = ticket.draw(randomNumber);

    if (mainWinner == address(0)) {
      emit NoWinners();
      return;
    }

    _awardAllExternalTokens(mainWinner);

    address[] memory winners = new address[](__numberOfWinners);
    winners[0] = mainWinner;

    uint256 totalSupply = IERC20(address(ticket)).totalSupply();
    uint256 ticketSplit = totalSupply.div(__numberOfWinners);
    uint256 nextRandom = randomNumber.add(ticketSplit);
    // the other winners receive their prizeShares
    for (uint256 winnerCount = 1; winnerCount < __numberOfWinners; winnerCount++) {
      winners[winnerCount] = ticket.draw(nextRandom);
      nextRandom = nextRandom.add(ticketSplit);
    }

    // yield prize is split up
    uint256 prizeShare = prize.div(__numberOfWinners);

    for (uint i = 0; i < __numberOfWinners; i++) {
      _awardTickets(winners[i], prizeShare);
    }
  }
}
