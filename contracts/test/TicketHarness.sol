pragma solidity ^0.6.4;

import "../ticket/Ticket.sol";

contract TicketHarness is Ticket {
  function mint(address user, uint256 amount) external {
    _mint(user, amount);
  }
}