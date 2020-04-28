pragma solidity ^0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./InterestPoolInterface.sol";
import "./Timelock.sol";
import "./TokenControllerInterface.sol";
import "./Ticket.sol";
import "./PrizeStrategyInterface.sol";
import "./PrizePoolInterface.sol";

/* solium-disable security/no-block-members */
contract PrizePool is Initializable, TokenControllerInterface, PrizePoolInterface {
  using SafeMath for uint256;
  using Timelock for Timelock.State;

  event TicketsRedeemedInstantly(address to, uint256 amount, uint256 fee);
  event TicketsRedeemedWithTimelock(address to, uint256 amount, uint256 unlockTimestamp);

  InterestPoolInterface public override interestPool;
  Ticket public override ticket;
  PrizeStrategyInterface public prizeStrategy;
  mapping(address => Timelock.State) timelocks;

  function initialize (
    Ticket _ticket,
    InterestPoolInterface _interestPool,
    PrizeStrategyInterface _prizeStrategy
  ) public initializer {
    require(address(_ticket) != address(0), "ticket must not be zero");
    require(address(_interestPool) != address(0), "prize pool must not be zero");
    require(address(_prizeStrategy) != address(0), "prizeStrategy must not be zero");
    ticket = _ticket;
    interestPool = _interestPool;
    prizeStrategy = _prizeStrategy;
  }

  function currentPrize() external view override returns (uint256) {
    return interestPool.availableInterest();
  }

  function mintTickets(uint256 tickets) external {
    // Transfer deposit
    IERC20 token = interestPool.underlying();
    require(token.allowance(msg.sender, address(this)) >= tickets, "insuff");
    token.transferFrom(msg.sender, address(this), tickets);

    // Deposit into pool
    interestPool.supply(tickets);

    // Mint tickets
    ticket.mint(msg.sender, tickets);
  }

  function redeemTicketsInstantly(uint256 tickets) external returns (uint256) {
    uint256 exitFee = prizeStrategy.calculateExitFee(msg.sender, tickets);

    // burn the tickets
    ticket.burn(msg.sender, tickets);

    // redeem the collateral
    interestPool.redeem(tickets);

    // transfer tickets less fee
    uint256 balance = tickets.sub(exitFee);
    interestPool.underlying().transfer(msg.sender, balance);

    // return the amount that was transferred
    return balance;
  }

  function redeemTicketsWithTimelock(uint256 tickets) external returns (uint256) {
    uint256 unlockTimestamp = prizeStrategy.calculateUnlockTimestamp(msg.sender, tickets);

    // burn the tickets
    ticket.burn(msg.sender, tickets);

    uint256 change;
    if (block.timestamp >= unlockTimestamp) {
      // just transfer old funds, if any
      (change,) = timelocks[msg.sender].withdrawAt(unlockTimestamp);
      // add the new funds
      change = change.add(tickets);
    } else {
      (change,) = timelocks[msg.sender].deposit(tickets, unlockTimestamp);
    }

    // if there is change, withdraw the change and transfer
    if (change > 0) {
      interestPool.redeem(change);
      interestPool.underlying().transfer(msg.sender, change);
    }

    // return the block at which the funds will be available
    return unlockTimestamp;
  }

  function lockedBalanceOf(address user) external view returns (uint256) {
    return timelocks[user].amount;
  }

  function lockedBalanceAvailableAt(address user) external view returns (uint256) {
    return timelocks[user].timestamp;
  }

  function sweepTimelockFunds(address[] calldata users) external returns (uint256) {
    uint256 totalWithdrawal;

    // first gather the total withdrawal and fee
    uint256 i;
    for (i = 0; i < users.length; i++) {
      address user = users[i];
      (uint256 tickets,) = timelocks[user].balanceAt(block.timestamp);
      totalWithdrawal = totalWithdrawal.add(tickets);
    }

    // pull out the collateral
    if (totalWithdrawal > 0) {
      interestPool.redeem(totalWithdrawal);
    }

    for (i = 0; i < users.length; i++) {
      address user = users[i];
      (uint256 tickets,) = timelocks[user].withdrawAt(block.timestamp);
      if (tickets > 0) {
        interestPool.underlying().transfer(user, tickets);
      }
    }
  }

  function award(address winner, uint256 amount) external override onlyPrizeStrategy {
    interestPool.allocateInterest(address(this), amount);
    ticket.mint(winner, amount);
  }

  modifier onlyPrizeStrategy() {
    require(msg.sender == address(prizeStrategy), "only prizeStrategy");
    _;
  }

  function beforeTokenTransfer(address from, address to, uint256 tokenAmount) external override {}
}