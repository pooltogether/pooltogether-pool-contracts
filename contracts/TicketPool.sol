pragma solidity ^0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./IInterestPool.sol";
import "./Timelock.sol";
import "./ITokenController.sol";
import "./Ticket.sol";
import "./IPrizeStrategy.sol";

contract TicketPool is Initializable, ITokenController {
  using SafeMath for uint256;
  using Timelock for Timelock.State;

  IERC1820Registry constant internal ERC1820_REGISTRY = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);

  // keccak256("ERC777TokensRecipient")
  bytes32 constant internal TOKENS_RECIPIENT_INTERFACE_HASH = 0xb281fc8c12954d22544db45de3159a39272895b169a852b314f9cc762e44c53b;

  IInterestPool public interestPool;
  Ticket public ticketToken;
  IPrizeStrategy public prizeStrategy;
  mapping(address => Timelock.State) timelocks;

  function initialize (
    Ticket _ticketToken,
    IInterestPool _interestPool,
    IPrizeStrategy _prizeStrategy
  ) public initializer {
    require(address(_ticketToken) != address(0), "ticketToken must not be zero");
    require(address(_interestPool) != address(0), "prize pool must not be zero");
    require(address(_prizeStrategy) != address(0), "prizeStrategy must not be zero");
    ticketToken = _ticketToken;
    ERC1820_REGISTRY.setInterfaceImplementer(address(this), TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
    interestPool = _interestPool;
    prizeStrategy = _prizeStrategy;
  }

  function currentPrize() external view returns (uint256) {
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

    // allocate tickets for the msg.sender.
    (uint256 change,) = timelocks[msg.sender].deposit(tickets, unlockBlock);

    // if there is change, withdraw the change and transfer
    if (change > 0) {
      interestPool.redeemCollateral(change);
      interestPool.underlyingToken().transfer(msg.sender, change);
    }

    // return the block at which the funds will be available
    return unlockBlock;
  }

  function sweepUnlockedFunds(address[] calldata) external pure returns (uint256) {
    revert("not implemented");
  }

  function award(address winner, uint256 amount) external onlyPrizeStrategy {
    interestPool.allocateInterest(address(this), amount);
    ticketToken.mint(winner, amount);
  }

  modifier onlyPrizeStrategy() {
    require(msg.sender == address(prizeStrategy), "only prizeStrategy");
    _;
  }

  function beforeTokenTransfer(address from, address to, uint256 tokenAmount) external override {}
}