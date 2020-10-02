// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "./MultipleWinnersHarness.sol";
import "../external/openzeppelin/ProxyFactory.sol";

/// @title Creates a minimal proxy to the MultipleWinners prize strategy.  Very cheap to deploy.
contract MultipleWinnersHarnessProxyFactory is ProxyFactory {

  MultipleWinnersHarness public instance;

  constructor () public {
    instance = new MultipleWinnersHarness();
  }

  function create() external returns (MultipleWinnersHarness) {
    return MultipleWinnersHarness(deployMinimal(address(instance), ""));
  }

}