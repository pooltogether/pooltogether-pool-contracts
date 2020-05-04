pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "./RNGInterface.sol";
import "./DistributionStrategyInterface.sol";
import "./PrizePoolInterface.sol";

/* solium-disable security/no-block-members */
contract SingleRandomWinnerPrizeStrategy is Initializable, DistributionStrategyInterface {
  using SafeMath for uint256;

  function distribute(uint256 randomNumber, uint256 prize) external override {
    PrizePoolInterface prizePool = PrizePoolInterface(msg.sender);
    prizePool.sponsorship().transferFrom(address(prizePool), address(this), prize);
    address winner = prizePool.ticket().draw(randomNumber);
    // Convert the sponsorship to winnings
    prizePool.mintTicketsWithSponsorshipTo(winner, prize);
  }
}
