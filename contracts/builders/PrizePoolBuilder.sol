// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "../prize-pool/PrizePool.sol";
import "../prize-strategy/PeriodicPrizeStrategy.sol";

contract PrizePoolBuilder {
  using SafeCastUpgradeable for uint256;

  event PrizePoolCreated (
    address indexed creator,
    address indexed prizePool
  );
}