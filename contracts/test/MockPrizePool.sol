pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "../PrizePoolInterface.sol";
import "../Ticket.sol";
import "../TokenControllerInterface.sol";

contract MockPrizePool is Initializable, PrizePoolInterface, TokenControllerInterface {

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

  function mintTickets(uint256 tickets) external override {}

  function redeemTicketsInstantly(uint256 tickets) external override returns (uint256) {}

  function redeemTicketsWithTimelock(uint256 tickets) external override returns (uint256) {}

  function lockedBalanceOf(address user) external override view returns (uint256) {}

  function lockedBalanceAvailableAt(address user) external override view returns (uint256) {}

  function sweepTimelockFunds(address[] calldata users) external override returns (uint256) {}
  

  function beforeTokenTransfer(address from, address to, uint256 tokenAmount) external override {}
}