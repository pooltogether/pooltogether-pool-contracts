pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";
import "@nomiclabs/buidler/console.sol";

import "../rng/RNGInterface.sol";
import "./PrizeStrategyInterface.sol";
import "../prize-pool/PrizePoolInterface.sol";
import "../util/ERC1820Helper.sol";

/* solium-disable security/no-block-members */
contract SingleRandomWinnerPrizeStrategy is Initializable, PrizeStrategyInterface, ERC1820Helper, IERC777Recipient {
  using SafeMath for uint256;

  function initialize() public initializer {
    ERC1820_REGISTRY.setInterfaceImplementer(address(this), ERC1820_TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
  }

  function award(uint256 randomNumber, uint256 prize) external override {
    // console.log("awarding prize: %s", prize);
    if (prize > 0) {
      PrizePoolInterface prizePool = PrizePoolInterface(msg.sender);
      // console.log("transfer sponsorship");
      prizePool.sponsorship().transferFrom(address(prizePool), address(this), prize);
      // console.log("draw ticket");
      address winner = prizePool.ticket().draw(randomNumber);

      uint256 balance = prizePool.sponsorship().balanceOf(address(this));
      // console.log("balance: %s", balance);

      // console.log("mint sponsorship");
      // Convert the sponsorship to winnings
      prizePool.sponsorship().approve(address(prizePool.ticket()), prize);
      prizePool.ticket().mintTicketsWithSponsorshipTo(winner, prize);
    }
  }

  function tokensReceived(
    address operator,
    address from,
    address to,
    uint256 amount,
    bytes calldata userData,
    bytes calldata operatorData
  ) external override {
  }
}
