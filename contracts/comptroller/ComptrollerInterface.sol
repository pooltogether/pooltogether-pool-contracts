// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.5.0 <0.7.0;

import "../prize-pool/PrizePoolTokenListenerInterface.sol";

interface ComptrollerInterface is PrizePoolTokenListenerInterface {
  function reserveRateMantissa() external view returns (uint256);
}
