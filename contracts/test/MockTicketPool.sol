pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "../TicketPoolInterface.sol";
import "../Ticket.sol";
import "../TokenControllerInterface.sol";

contract MockTicketPool is Initializable, TicketPoolInterface, TokenControllerInterface {

  Ticket public override ticketToken;
  InterestPoolInterface public override interestPool;
  uint256 public override currentPrize;

  function initialize (
    Ticket _ticketToken,
    InterestPoolInterface _interestPool
  ) public initializer {
    require(address(_ticketToken.controller()) == address(this), "controller matches");
    ticketToken = _ticketToken;
    interestPool = _interestPool;
  }

  function setCurrentPrize(uint256 _currentPrize) external {
    currentPrize = _currentPrize;
  }

  function award(address user, uint256 tickets) external override {
    ticketToken.mint(user, tickets);
  }

  function beforeTokenTransfer(address from, address to, uint256 tokenAmount) external override {}
}