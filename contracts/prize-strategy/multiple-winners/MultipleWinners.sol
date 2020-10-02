// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import "../PeriodicPrizeStrategy.sol";

contract MultipleWinners is PeriodicPrizeStrategy {

  uint256 public numberOfWinners;

  function initialize(
    address _trustedForwarder,
    uint256 _prizePeriodStart,
    uint256 _prizePeriodSeconds,
    PrizePool _prizePool,
    address _ticket,
    address _sponsorship,
    RNGInterface _rng,
    address[] memory _externalErc20s,
    uint256 _numberOfWinners
  ) public initializer {
    PeriodicPrizeStrategy.initialize(
      _trustedForwarder,
      _prizePeriodStart,
      _prizePeriodSeconds,
      _prizePool,
      _ticket,
      _sponsorship,
      _rng,
      _externalErc20s
    );
    require(_numberOfWinners > 0, "MultipleWinners/num-gt-zero");
    numberOfWinners = _numberOfWinners;
  }

  function _distribute(uint256 randomNumber) internal override {
    uint256 prize = prizePool.captureAwardBalance();

    // main winner gets all external tokens
    address mainWinner = ticket.draw(randomNumber);
    _awardAllExternalTokens(mainWinner);

    address[] memory winners = new address[](numberOfWinners);
    winners[0] = mainWinner;

    uint256 totalSupply = IERC20(address(ticket)).totalSupply();
    uint256 ticketSplit = totalSupply.div(numberOfWinners);
    uint256 nextRandom = randomNumber.add(ticketSplit);
    // the other winners receive their prizeShares
    for (uint256 winnerCount = 1; winnerCount < numberOfWinners; winnerCount++) {
      winners[winnerCount] = ticket.draw(nextRandom);
      nextRandom = nextRandom.add(ticketSplit);
    }

    // yield prize is split up
    // Track nextPrize and prize separately to eliminate dust
    uint256 prizeShare = prize.div(numberOfWinners);

    for (uint i = 0; i < numberOfWinners; i++) {
      _awardTickets(winners[i], prizeShare);
    }
  }
}
