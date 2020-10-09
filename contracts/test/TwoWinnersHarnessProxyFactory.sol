// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "./TwoWinnersHarness.sol";
import "../external/openzeppelin/ProxyFactory.sol";

contract TwoWinnersHarnessProxyFactory is ProxyFactory {

  TwoWinnersHarness public instance;

  constructor () public {
    instance = new TwoWinnersHarness();
  }

  function create() external returns (TwoWinnersHarness) {
    return TwoWinnersHarness(deployMinimal(address(instance), ""));
  }

}
