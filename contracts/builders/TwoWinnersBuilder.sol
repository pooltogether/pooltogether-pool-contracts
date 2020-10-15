// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "../prize-strategy/two-winners//TwoWinnersProxyFactory.sol";

/* solium-disable security/no-block-members */
contract TwoWinnersBuilder {

  event CreatedTwoWinners(address indexed oldPrizeStrategy, address indexed prizeStrategy);

  TwoWinnersProxyFactory public twoWinnersProxyFactory;

  constructor (
    TwoWinnersProxyFactory _twoWinnersProxyFactory
  ) public {
    require(address(_twoWinnersProxyFactory) != address(0), "TwoWinnersBuilder/twoWinnersProxyFactory-not-zero");
    twoWinnersProxyFactory = _twoWinnersProxyFactory;
  }

  function createTwoWinners(
    PeriodicPrizeStrategy prizeStrategy
  ) external returns (TwoWinners) {
    TwoWinners tw = twoWinnersProxyFactory.create();

    address[] memory externalErc20s;

    tw.initialize(
      prizeStrategy.trustedForwarder(),
      prizeStrategy.prizePeriodStartedAt(),
      prizeStrategy.prizePeriodSeconds(),
      prizeStrategy.prizePool(),
      address(prizeStrategy.ticket()),
      address(prizeStrategy.sponsorship()),
      prizeStrategy.rng(),
      externalErc20s
    );

    emit CreatedTwoWinners(address(prizeStrategy), address(tw));

    return tw;
  }
}
