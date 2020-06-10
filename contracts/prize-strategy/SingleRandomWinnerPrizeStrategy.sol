pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";
import "@nomiclabs/buidler/console.sol";

import "../rng/RNGInterface.sol";
import "./PrizeStrategyInterface.sol";
import "../modules/periodic-prize-pool/PeriodicPrizePoolInterface.sol";
import "../Constants.sol";

/* solium-disable security/no-block-members */
contract SingleRandomWinnerPrizeStrategy is Initializable, PrizeStrategyInterface, IERC777Recipient {
  using SafeMath for uint256;

  function initialize() public initializer {
    Constants.REGISTRY.setInterfaceImplementer(address(this), Constants.TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
  }

  function award(uint256 randomNumber, uint256 prize) external override {
    if (prize > 0) {
      NamedModule prizePoolModule = NamedModule(msg.sender);
      PrizePoolModuleManager manager = PrizePoolModuleManager(address(prizePoolModule.manager()));
      Ticket ticket = manager.ticket();
      address winner = ticket.draw(randomNumber);
      // Convert the sponsorship to winnings
      manager.sponsorship().approve(address(ticket), prize);
      ticket.mintTicketsWithSponsorshipTo(winner, prize);
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
