// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.6.12;

library PeriodicPrizeStrategyListenerLibrary {
  /*
    *     bytes4(keccak256('afterPrizePoolAwarded(uint256,uint256)')) == 0x575072c6
    */
  bytes4 public constant ERC165_INTERFACE_ID_PERIODIC_PRIZE_STRATEGY_LISTENER = 0x575072c6;
}
