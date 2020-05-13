pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "../rng/RNGInterface.sol";
import "./PrizeStrategyInterface.sol";
import "../prize-pool/PrizePoolInterface.sol";

/* solium-disable security/no-block-members */
contract SingleRandomWinnerPrizeStrategy is Initializable, PrizeStrategyInterface {
  using SafeMath for uint256;

  function award(uint256 randomNumber, uint256 prize) external override {
    if (prize > 0) {
      PrizePoolInterface prizePool = PrizePoolInterface(msg.sender);
      prizePool.sponsorship().transferFrom(address(prizePool), address(this), prize);
      address winner = prizePool.ticket().draw(randomNumber);
      // Convert the sponsorship to winnings
      prizePool.ticket().mintTicketsWithSponsorshipTo(winner, prize);
    }
  }
}
