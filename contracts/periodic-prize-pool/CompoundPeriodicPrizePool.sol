pragma solidity ^0.6.4;

import "./PeriodicPrizePool.sol";
import "./CompoundYieldService.sol";

contract CompoundPeriodicPrizePool is PeriodicPrizePool, CompoundYieldService {
  function initialize (
    address _trustedForwarder,
    GovernorInterface _governor,
    PrizeStrategyInterface _prizeStrategy,
    RNGInterface _rng,
    uint256 _prizePeriodSeconds,
    CTokenInterface _cToken
  ) public initializer {
    PeriodicPrizePool.initialize(
      _trustedForwarder,
      _governor,
      _prizeStrategy,
      _rng,
      _prizePeriodSeconds
    );
    cToken = _cToken;
  }
}