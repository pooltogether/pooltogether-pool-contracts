pragma solidity ^0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
// import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@nomiclabs/buidler/console.sol";

import "../external/openzeppelin/ReentrancyGuard.sol";
import "../yield-service/YieldServiceInterface.sol";
import "../token/TokenControllerInterface.sol";
import "../token/Ticket.sol";
import "./PrizePoolInterface.sol";
import "../prize-strategy/PrizeStrategyInterface.sol";
import "../rng/RNGInterface.sol";

/* solium-disable security/no-block-members */
abstract contract PrizePool is ReentrancyGuard, TokenControllerInterface, PrizePoolInterface {
  using SafeMath for uint256;

  event TicketsRedeemedInstantly(address indexed to, uint256 amount, uint256 fee);
  event TicketsRedeemedWithTimelock(address indexed to, uint256 amount, uint256 unlockTimestamp);

  YieldServiceInterface public override yieldService;
  Ticket public override ticket;
  ControlledToken public override sponsorship;
  ControlledToken public override timelock;
  PrizeStrategyInterface public override prizeStrategy;
  
  mapping(address => uint256) unlockTimestamps;

  constructor() public ReentrancyGuard() {}

  function initialize (
    Ticket _ticket,
    ControlledToken _sponsorship,
    ControlledToken _timelock,
    YieldServiceInterface _yieldService,
    PrizeStrategyInterface _prizeStrategy
  ) public initializer {
    ReentrancyGuard.initialize();
    require(address(_ticket) != address(0), "ticket must not be zero");
    require(address(_ticket.controller()) == address(this), "ticket controller does not match");
    require(address(_sponsorship) != address(0), "sponsorship must not be zero");
    require(address(_sponsorship.controller()) == address(this), "sponsorship controller does not match");
    require(address(_timelock) != address(0), "timelock must not be zero");
    require(address(_timelock.controller()) == address(this), "timelock controller does not match");
    require(address(_yieldService) != address(0), "prize pool must not be zero");
    require(address(_prizeStrategy) != address(0), "prizeStrategy must not be zero");
    ticket = _ticket;
    yieldService = _yieldService;
    prizeStrategy = _prizeStrategy;
    sponsorship = _sponsorship;
    timelock = _timelock;
  }

  function currentPrize() public view override returns (uint256) {
    return yieldService.balanceOf(address(this))
      .sub(
        ticket.totalSupply()
      )
      .sub(
        sponsorship.totalSupply()
      )
      .sub(
        timelock.totalSupply()
      );
  }

  function mintTickets(uint256 amount) external override nonReentrant {
    _mintTickets(msg.sender, amount);
  }

  function mintTicketsTo(address to, uint256 amount) external override nonReentrant {
    _mintTickets(to, amount);
  }

  function _mintTickets(address to, uint256 amount) internal {
    // Transfer deposit
    IERC20 token = yieldService.token();
    require(token.allowance(msg.sender, address(this)) >= amount, "insuff");
    token.transferFrom(msg.sender, address(this), amount);
    
    // Mint tickets
    ticket.mint(to, amount);

    // Deposit into pool
    token.approve(address(yieldService), amount);
    yieldService.supply(amount);
  }

  function mintTicketsWithSponsorship(uint256 amount) external override {
    _mintTicketsWithSponsorship(msg.sender, amount);
  }

  function mintTicketsWithSponsorshipTo(address to, uint256 amount) external override {
    _mintTicketsWithSponsorship(to, amount);
  }

  function mintTicketsWithTimelock(uint256 amount) external override {
    // Subtract timelocked funds
    timelock.burn(msg.sender, amount);

    // Mint tickets
    ticket.mint(msg.sender, amount);
  }

  function _mintTicketsWithSponsorship(address to, uint256 amount) internal {
    // Burn sponsorship
    sponsorship.burn(msg.sender, amount);

    // Mint tickets
    ticket.mint(to, amount);
  }

  function mintSponsorship(uint256 amount) external override nonReentrant {
    _mintSponsorship(msg.sender, amount);
  }

  function mintSponsorshipTo(address to, uint256 amount) external override nonReentrant {
    _mintSponsorship(to, amount);
  }

  function _mintSponsorship(address to, uint256 amount) internal {
    // Transfer deposit
    IERC20 token = yieldService.token();
    require(token.allowance(msg.sender, address(this)) >= amount, "insuff");
    token.transferFrom(msg.sender, address(this), amount);

    // create the sponsorship
    sponsorship.mint(to, amount);

    // Deposit into pool
    token.approve(address(yieldService), amount);
    yieldService.supply(amount);
  }

  function redeemSponsorship(uint256 amount) external override nonReentrant {
    // burn the sponsorship
    sponsorship.burn(msg.sender, amount);

    // redeem the collateral
    yieldService.redeem(amount);

    // transfer back to user
    IERC20(yieldService.token()).transfer(msg.sender, amount);
  }

  function redeemTicketsInstantly(uint256 tickets) external override nonReentrant returns (uint256) {
    uint256 exitFee = calculateExitFee(msg.sender, tickets);

    // burn the tickets
    ticket.burn(msg.sender, tickets);

    // redeem the collateral
    yieldService.redeem(tickets);

    // transfer tickets less fee
    uint256 balance = tickets.sub(exitFee);
    IERC20(yieldService.token()).transfer(msg.sender, balance);

    // return the amount that was transferred
    return balance;
  }

  function redeemTicketsWithTimelock(uint256 tickets) external override nonReentrant returns (uint256) {
    uint256 unlockTimestamp = calculateUnlockTimestamp(msg.sender, tickets);

    // burn the tickets
    ticket.burn(msg.sender, tickets);

    uint256 transferChange;

    // See if we need to sweep the old balance
    uint256 balance = timelock.balanceOf(msg.sender);
    if (unlockTimestamps[msg.sender] <= block.timestamp && balance > 0) {
      transferChange = balance;
      timelock.burn(msg.sender, balance);
    }

    // if we are locking these funds for the future
    if (unlockTimestamp > block.timestamp) {
      // time lock new tokens
      timelock.mint(msg.sender, tickets);
      unlockTimestamps[msg.sender] = unlockTimestamp;
    } else { // add funds to change
      transferChange = transferChange.add(tickets);
    }

    // if there is change, withdraw the change and transfer
    if (transferChange > 0) {
      yieldService.redeem(transferChange);
      IERC20(yieldService.token()).transfer(msg.sender, transferChange);
    }

    // return the block at which the funds will be available
    return unlockTimestamp;
  }

  function timelockBalanceAvailableAt(address user) external view override returns (uint256) {
    return unlockTimestamps[user];
  }

  function sweepTimelockFunds(address[] calldata users) external override nonReentrant returns (uint256) {
    uint256 totalWithdrawal;

    // first gather the total withdrawal and fee
    uint256 i;
    for (i = 0; i < users.length; i++) {
      address user = users[i];
      if (unlockTimestamps[user] <= block.timestamp) {
        totalWithdrawal = timelock.balanceOf(user);
      }
    }

    // pull out the collateral
    if (totalWithdrawal > 0) {
      yieldService.redeem(totalWithdrawal);
    }

    for (i = 0; i < users.length; i++) {
      address user = users[i];
      if (unlockTimestamps[user] <= block.timestamp) {
        uint256 balance = timelock.balanceOf(user);
        if (balance > 0) {
          timelock.burn(user, balance);
          IERC20(yieldService.token()).transfer(user, balance);
        }
      }
    }
  }

  function beforeTokenTransfer(address from, address to, uint256) external override {
    if (msg.sender == address(timelock)) {
      require(from == address(0) || to == address(0), "only minting or burning is allowed");
    }
  }

  function calculateExitFee(address sender, uint256 tickets) public virtual override view returns (uint256);
  function calculateUnlockTimestamp(address sender, uint256 tickets) public virtual override view returns (uint256);
}