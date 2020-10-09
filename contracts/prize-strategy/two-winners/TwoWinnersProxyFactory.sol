// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "./TwoWinners.sol";
import "../../external/openzeppelin/ProxyFactory.sol";

/// @title Creates a minimal proxy to the TwoWinners prize strategy.  Very cheap to deploy.
contract TwoWinnersProxyFactory is ProxyFactory {

  TwoWinners public instance;

  constructor () public {
    instance = new TwoWinners();
  }

  function create() external returns (TwoWinners) {
    return TwoWinners(deployMinimal(address(instance), ""));
  }

}
