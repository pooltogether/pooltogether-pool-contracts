// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.6.12;

library BeforeAwardListenerLibrary {
  /*
    *     bytes4(keccak256('beforePrizePoolAwarded(uint256,uint256)')) == 0x4cdf9c3e
    */
  bytes4 public constant ERC165_INTERFACE_ID_BEFORE_AWARD_LISTENER = 0x4cdf9c3e;
}