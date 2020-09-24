// SPDX-License-Identifier: GPL-3.0-only

pragma solidity >=0.6.0 <0.7.0;

import "../prize-pool/PrizePool.sol";
import "../prize-strategy/single-random-winner/SingleRandomWinner.sol";

contract PrizePoolBuilder {
  using SafeCast for uint256;

  function _setupSingleRandomWinner(
    PrizePool prizePool,
    SingleRandomWinner singleRandomWinner,
    uint256 ticketCreditRateMantissa,
    uint256 ticketCreditLimitMantissa
  ) internal {
    address ticket = address(singleRandomWinner.ticket());

    prizePool.addControlledToken(ticket);
    prizePool.addControlledToken(address(singleRandomWinner.sponsorship()));

    prizePool.setCreditPlanOf(
      ticket,
      ticketCreditRateMantissa.toUint128(),
      ticketCreditLimitMantissa.toUint128()
    );

    prizePool.setReserveFeeControlledToken(address(singleRandomWinner.sponsorship()));
  }
}