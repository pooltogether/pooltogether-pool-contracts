pragma solidity ^0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@nomiclabs/buidler/console.sol";

import "./InterestPoolInterface.sol";
import "./Timelock.sol";
import "./TokenControllerInterface.sol";
import "./Ticket.sol";
import "./PrizePoolInterface.sol";
import "./PrizeStrategyInterface.sol";
import "./RNGInterface.sol";

/* solium-disable security/no-block-members */
abstract contract PrizePool is Initializable, TokenControllerInterface, PrizePoolInterface {
  using SafeMath for uint256;
  using Timelock for Timelock.State;

  event TicketsRedeemedInstantly(address indexed to, uint256 amount, uint256 fee);
  event TicketsRedeemedWithTimelock(address indexed to, uint256 amount, uint256 unlockTimestamp);

  InterestPoolInterface public override interestPool;
  Ticket public override ticket;
  ControlledToken public override sponsorship;
  PrizeStrategyInterface public prizeStrategy;
  
  mapping(address => Timelock.State) timelocks;

  function initialize (
    Ticket _ticket,
    ControlledToken _sponsorship,
    InterestPoolInterface _interestPool,
    PrizeStrategyInterface _prizeStrategy
  ) public initializer {
    require(address(_ticket) != address(0), "ticket must not be zero");
    require(address(_ticket.controller()) == address(this), "ticket controller does not match");
    require(address(_sponsorship) != address(0), "sponsorship must not be zero");
    require(address(_sponsorship.controller()) == address(this), "sponsorship controller does not match");
    require(address(_interestPool) != address(0), "prize pool must not be zero");
    require(address(_prizeStrategy) != address(0), "prizeStrategy must not be zero");
    ticket = _ticket;
    interestPool = _interestPool;
    prizeStrategy = _prizeStrategy;
    sponsorship = _sponsorship;
  }

  function currentPrize() public view override returns (uint256) {
    return interestPool.balanceOf(address(this)).sub(ticket.totalSupply()).sub(sponsorship.totalSupply());
  }

  function mintTickets(uint256 amount) external override {
    _mintTickets(msg.sender, amount);
  }

  function mintTicketsTo(address to, uint256 amount) external override {
    _mintTickets(to, amount);
  }

  function _mintTickets(address to, uint256 amount) internal {
    // Transfer deposit
    IERC20 token = interestPool.token();
    require(token.allowance(msg.sender, address(this)) >= amount, "insuff");
    token.transferFrom(msg.sender, address(this), amount);
    
    // Mint tickets
    ticket.mint(to, amount);

    // Deposit into pool
    token.approve(address(interestPool), amount);
    interestPool.supply(amount);
  }

  function mintTicketsWithSponsorship(uint256 amount) external override {
    _mintTicketsWithSponsorship(msg.sender, amount);
  }

  function mintTicketsWithSponsorshipTo(address to, uint256 amount) external override {
    _mintTicketsWithSponsorship(to, amount);
  }

  function mintTicketsWithTimelock(uint256 amount) external override {
    // Subtract timelocked funds
    timelocks[msg.sender].amount = timelocks[msg.sender].amount.sub(amount);

    // Mint tickets
    ticket.mint(msg.sender, amount);
  }

  function _mintTicketsWithSponsorship(address to, uint256 amount) internal {
    // Burn sponsorship
    sponsorship.burn(to, amount);

    // Mint tickets
    ticket.mint(to, amount);
  }

  function redeemTicketsInstantly(uint256 tickets) external override returns (uint256) {
    uint256 exitFee = calculateExitFee(msg.sender, tickets);

    // burn the tickets
    ticket.burn(msg.sender, tickets);

    // redeem the collateral
    interestPool.redeem(tickets);

    // transfer tickets less fee
    uint256 balance = tickets.sub(exitFee);
    IERC20(interestPool.token()).transfer(msg.sender, balance);

    // return the amount that was transferred
    return balance;
  }

  function redeemTicketsWithTimelock(uint256 tickets) external override returns (uint256) {
    uint256 unlockTimestamp = calculateUnlockTimestamp(msg.sender, tickets);

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
      IERC20(interestPool.token()).transfer(msg.sender, change);
    }

    // return the block at which the funds will be available
    return unlockTimestamp;
  }

  function lockedBalanceOf(address user) external view override returns (uint256) {
    return timelocks[user].amount;
  }

  function lockedBalanceAvailableAt(address user) external view override returns (uint256) {
    return timelocks[user].timestamp;
  }

  function sweepTimelockFunds(address[] calldata users) external override returns (uint256) {
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
        IERC20(interestPool.token()).transfer(user, tickets);
      }
    }
  }

  function beforeTokenTransfer(address from, address to, uint256 tokenAmount) external override {}

  function calculateExitFee(address sender, uint256 tickets) public virtual override view returns (uint256);
  function calculateUnlockTimestamp(address sender, uint256 tickets) public virtual override view returns (uint256);
}