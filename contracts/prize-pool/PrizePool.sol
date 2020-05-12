pragma solidity ^0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@nomiclabs/buidler/console.sol";
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";

import "../external/openzeppelin/ReentrancyGuard.sol";
import "../yield-service/YieldServiceInterface.sol";
import "../token/TokenControllerInterface.sol";
import "../token/Ticket.sol";
import "./PrizePoolInterface.sol";
import "../prize-strategy/PrizeStrategyInterface.sol";
import "../rng/RNGInterface.sol";
import "../util/ERC1820Helper.sol";
import "../token/ControlledTokenFactory.sol";

/* solium-disable security/no-block-members */
abstract contract PrizePool is ReentrancyGuard, BaseRelayRecipient, TokenControllerInterface, PrizePoolInterface, ERC1820Helper {
  using SafeMath for uint256;

  event TicketsRedeemedInstantly(address indexed to, uint256 amount, uint256 fee);
  event TicketsRedeemedWithTimelock(address indexed to, uint256 amount, uint256 unlockTimestamp);

  YieldServiceInterface public override yieldService;
  Ticket public override ticket;
  ControlledToken public override sponsorship;
  ControlledToken public override timelock;
  ControlledToken public override loyalty;
  PrizeStrategyInterface public override prizeStrategy;
  
  mapping(address => uint256) unlockTimestamps;

  constructor() public ReentrancyGuard() {}

  function initialize (
    Ticket _ticket,
    ControlledToken _sponsorship,
    ControlledTokenFactory _controlledTokenFactory,
    YieldServiceInterface _yieldService,
    PrizeStrategyInterface _prizeStrategy,
    address _trustedForwarder
  ) public initializer {
    ReentrancyGuard.initialize();
    require(address(_ticket) != address(0), "ticket must not be zero");
    require(address(_ticket.controller()) == address(this), "ticket controller does not match");
    require(address(_sponsorship) != address(0), "sponsorship must not be zero");
    require(address(_sponsorship.controller()) == address(this), "sponsorship controller does not match");
    require(address(_controlledTokenFactory) != address(0), "_controlledTokenFactory must not be zero");
    require(address(_yieldService) != address(0), "prize pool must not be zero");
    require(address(_prizeStrategy) != address(0), "prizeStrategy must not be zero");
    ticket = _ticket;
    yieldService = _yieldService;
    prizeStrategy = _prizeStrategy;
    sponsorship = _sponsorship;
    timelock = _controlledTokenFactory.createControlledToken(address(this), _trustedForwarder);
    loyalty = _controlledTokenFactory.createControlledToken(address(this), _trustedForwarder);
    trustedForwarder = _trustedForwarder;
    _ERC1820_REGISTRY.setInterfaceImplementer(address(this), ERC1820_TOKEN_CONTROLLER_INTERFACE_HASH, address(this));
  }

  function currentPrize() public override returns (uint256) {
    uint256 yieldBalance = yieldService.balanceOf(address(this));
    uint256 supply = accountedSupply();
    uint256 prize;
    if (yieldBalance > supply) {
      prize = yieldBalance.sub(supply);
    }
    return prize;
  }

  function accountedSupply() public view override returns (uint256) {
    return ticket.totalSupply().add(sponsorship.totalSupply()).add(timelock.totalSupply());
  }

  function mintTickets(uint256 amount) external override nonReentrant {
    _mintTickets(_msgSender(), amount);
  }

  function mintTicketsTo(address to, uint256 amount) external override nonReentrant {
    _mintTickets(to, amount);
  }

  function _mintTickets(address to, uint256 amount) internal {
    // Transfer deposit
    IERC20 token = yieldService.token();
    require(token.allowance(_msgSender(), address(this)) >= amount, "insuff");
    token.transferFrom(_msgSender(), address(this), amount);
    
    // Mint tickets
    ticket.mint(to, amount);

    // Deposit into pool
    token.approve(address(yieldService), amount);
    yieldService.supply(amount);
  }

  function mintTicketsWithSponsorship(uint256 amount) external override {
    _mintTicketsWithSponsorship(_msgSender(), amount);
  }

  function mintTicketsWithSponsorshipTo(address to, uint256 amount) external override {
    _mintTicketsWithSponsorship(to, amount);
  }

  function mintTicketsWithTimelock(uint256 amount) external override {
    // Subtract timelocked funds
    timelock.burn(_msgSender(), amount);

    // Mint tickets
    ticket.mint(_msgSender(), amount);
  }

  function _mintTicketsWithSponsorship(address to, uint256 amount) internal {
    // Burn sponsorship
    sponsorship.burn(_msgSender(), amount);

    // Mint tickets
    ticket.mint(to, amount);
  }

  function mintSponsorship(uint256 amount) external override nonReentrant {
    _mintSponsorship(_msgSender(), amount);
  }

  function mintSponsorshipTo(address to, uint256 amount) external override nonReentrant {
    _mintSponsorship(to, amount);
  }

  function _mintSponsorship(address to, uint256 amount) internal {
    // Transfer deposit
    IERC20 token = yieldService.token();
    require(token.allowance(_msgSender(), address(this)) >= amount, "insuff");
    token.transferFrom(_msgSender(), address(this), amount);

    // create the sponsorship
    sponsorship.mint(to, amount);

    // Deposit into pool
    token.approve(address(yieldService), amount);
    yieldService.supply(amount);
  }

  function redeemSponsorship(uint256 amount) external override nonReentrant {
    // burn the sponsorship
    sponsorship.burn(_msgSender(), amount);

    // redeem the collateral
    yieldService.redeem(amount);

    // transfer back to user
    IERC20(yieldService.token()).transfer(_msgSender(), amount);
  }

  function redeemTicketsInstantly(uint256 tickets) external override nonReentrant returns (uint256) {
    uint256 exitFee = calculateExitFee(_msgSender(), tickets);

    // burn the tickets
    ticket.burn(_msgSender(), tickets);

    // redeem the collateral
    yieldService.redeem(tickets);

    // transfer tickets less fee
    uint256 balance = tickets.sub(exitFee);
    IERC20(yieldService.token()).transfer(_msgSender(), balance);

    // return the amount that was transferred
    return balance;
  }

  function redeemTicketsWithTimelock(uint256 tickets) external override nonReentrant returns (uint256) {
    uint256 unlockTimestamp = calculateUnlockTimestamp(_msgSender(), tickets);

    // burn the tickets
    ticket.burn(_msgSender(), tickets);

    uint256 transferChange;

    // See if we need to sweep the old balance
    uint256 balance = timelock.balanceOf(_msgSender());
    if (unlockTimestamps[_msgSender()] <= block.timestamp && balance > 0) {
      transferChange = balance;
      timelock.burn(_msgSender(), balance);
    }

    // if we are locking these funds for the future
    if (unlockTimestamp > block.timestamp) {
      // time lock new tokens
      timelock.mint(_msgSender(), tickets);
      unlockTimestamps[_msgSender()] = unlockTimestamp;
    } else { // add funds to change
      transferChange = transferChange.add(tickets);
    }

    // if there is change, withdraw the change and transfer
    if (transferChange > 0) {
      yieldService.redeem(transferChange);
      IERC20(yieldService.token()).transfer(_msgSender(), transferChange);
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
    if (
      _msgSender() == address(timelock) ||
      _msgSender() == address(loyalty)
    ) {
      require(from == address(0) || to == address(0), "only minting or burning is allowed");
    }
  }

  function calculateExitFee(address sender, uint256 tickets) public virtual override view returns (uint256);
  function calculateUnlockTimestamp(address sender, uint256 tickets) public virtual override view returns (uint256);
}