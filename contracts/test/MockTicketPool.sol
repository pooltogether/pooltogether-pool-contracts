pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "../TicketPoolInterface.sol";
import "../Ticket.sol";
import "../TokenControllerInterface.sol";

contract MockTicketPool is Initializable, TicketPoolInterface, TokenControllerInterface {

  Ticket public override ticket;
  InterestPoolInterface public override interestPool;

  function initialize (
    Ticket _ticket,
    InterestPoolInterface _interestPool
  ) public initializer {
    require(address(_ticket.controller()) == address(this), "controller matches");
    ticket = _ticket;
    interestPool = _interestPool;
  }

  function currentPrize() external view override returns (uint256) {
    return interestPool.availableInterest();
  }

  function award(address user, uint256 tickets) external override {
    ticket.mint(user, tickets);
  }

  function beforeTokenTransfer(address from, address to, uint256 tokenAmount) external override {}
}