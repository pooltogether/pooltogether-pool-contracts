pragma solidity ^0.6.4;

import "../modules/ticket/Ticket.sol";

contract TicketHarness is Ticket {
  function mint(address user, uint256 amount) public {
    _mint(user, amount, "", "");
  }

  function setInterestShares(address user, uint256 amount) public {
    interestShares[user] = amount;
  }
}