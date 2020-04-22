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
import "./TicketPoolInterface.sol";

contract TicketPool is Initializable, TokenControllerInterface, TicketPoolInterface {
  using SafeMath for uint256;
  using Timelock for Timelock.State;

  InterestPoolInterface public override interestPool;
  Ticket public override ticketToken;
  PrizeStrategyInterface public prizeStrategy;
  mapping(address => Timelock.State) timelocks;

  function initialize (
    Ticket _ticketToken,
    InterestPoolInterface _interestPool,
    PrizeStrategyInterface _prizeStrategy
  ) public initializer {
    require(address(_ticketToken) != address(0), "ticketToken must not be zero");
    require(address(_interestPool) != address(0), "prize pool must not be zero");
    require(address(_prizeStrategy) != address(0), "prizeStrategy must not be zero");
    ticketToken = _ticketToken;
    interestPool = _interestPool;
    prizeStrategy = _prizeStrategy;
  }

  function currentPrize() external view override returns (uint256) {
    return interestPool.availableInterest();
  }

  function mintTickets(uint256 tickets) external {
    // Transfer deposit
    IERC20 token = interestPool.underlyingToken();
    require(token.allowance(msg.sender, address(this)) >= tickets, "insuff");
    token.transferFrom(msg.sender, address(this), tickets);

    // Deposit into pool
    interestPool.supplyCollateral(tickets);

    // Mint tickets
    ticketToken.mint(msg.sender, tickets);
  }

  function redeemTicketsInstantly(uint256 tickets) external returns (uint256) {
    uint256 exitFee = prizeStrategy.calculateExitFee(msg.sender, tickets);

    // burn the tickets
    ticketToken.burn(msg.sender, tickets);

    // redeem the collateral
    interestPool.redeemCollateral(tickets);

    // transfer tickets less fee
    uint256 balance = tickets.sub(exitFee);
    interestPool.underlyingToken().transfer(msg.sender, balance);

    // return the amount that was transferred
    return balance;
  }

  function redeemTicketsWithTimelock(uint256 tickets) external returns (uint256) {
    uint256 unlockBlock = prizeStrategy.calculateUnlockBlock(msg.sender, tickets);

    // burn the tickets
    ticketToken.burn(msg.sender, tickets);

    uint256 change;
    if (block.number >= unlockBlock) {
      // just transfer old funds, if any
      (change,) = timelocks[msg.sender].withdrawAt(unlockBlock);
      // add the new funds
      change = change.add(tickets);
    } else {
      (change,) = timelocks[msg.sender].deposit(tickets, unlockBlock);
    }

    // if there is change, withdraw the change and transfer
    if (change > 0) {
      interestPool.redeemCollateral(change);
      interestPool.underlyingToken().transfer(msg.sender, change);
    }

    // return the block at which the funds will be available
    return unlockBlock;
  }

  function lockedBalanceOf(address user) external view returns (uint256) {
    return timelocks[user].amount;
  }

  function lockedBalanceAvailableAt(address user) external view returns (uint256) {
    return timelocks[user].unlockBlock;
  }

  function sweepTimelockFunds(address[] calldata users) external returns (uint256) {
    uint256 totalWithdrawal;

    // first gather the total withdrawal and fee
    uint256 i;
    for (i = 0; i < users.length; i++) {
      address user = users[i];
      (uint256 tickets,) = timelocks[user].balanceAt(block.number);
      totalWithdrawal = totalWithdrawal.add(tickets);
    }

    // pull out the collateral
    if (totalWithdrawal > 0) {
      interestPool.redeemCollateral(totalWithdrawal);
    }

    for (i = 0; i < users.length; i++) {
      address user = users[i];
      (uint256 tickets,) = timelocks[user].withdrawAt(block.number);
      if (tickets > 0) {
        interestPool.underlyingToken().transfer(user, tickets);
      }
    }
  }

  function award(address winner, uint256 amount) external override onlyPrizeStrategy {
    interestPool.allocateInterest(address(this), amount);
    ticketToken.mint(winner, amount);
  }

  modifier onlyPrizeStrategy() {
    require(msg.sender == address(prizeStrategy), "only prizeStrategy");
    _;
  }

  function beforeTokenTransfer(address from, address to, uint256 tokenAmount) external override {}
}