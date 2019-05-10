pragma solidity ^0.5.0;

import "openzeppelin-eth/contracts/token/ERC20/IERC20.sol";
import "./compound/IMoneyMarket.sol";
import "openzeppelin-eth/contracts/math/SafeMath.sol";
import "openzeppelin-eth/contracts/ownership/Ownable.sol";
import "./UniformRandomNumber.sol";

/**
 * @title The Lottery contract for PoolTogether
 * @author Brendan Asselstine
 * @notice This contract pools deposits together  accept deposits, use the pool the deposits together to supply the Compound
 * contract, then withdraw the amount plus interest and pay the interest to the lottery winner.
 */
contract Lottery is Ownable {
  using SafeMath for uint256;

  uint public constant MAX_UINT = 2**256 - 1;

  event BoughtTicket(address indexed sender, uint256 amount);
  event BoughtTickets(address indexed sender, uint256 count);
  event Withdrawn(address indexed sender);
  event LotteryLocked();
  event LotteryUnlocked();

  enum State {
    OPEN,
    LOCKED,
    COMPLETE
  }

  struct Entry {
    address addr;
    uint256 amount;
    uint256 ticketCount;
  }

  uint256 private totalAmount;
  uint256 private bondStartBlock;
  uint256 private bondEndBlock;
  bytes32 private secretHash;
  bytes32 private secret;
  State public state;
  uint256 private finalAmount;
  address[] private ticketAddresses;
  mapping (address => Entry) private entries;
  IMoneyMarket public moneyMarket;
  IERC20 public token;
  uint256 private ticketPrice;

  /**
   * @notice Creates a new Lottery.
   * @param _moneyMarket The Compound money market to supply tokens to.
   * @param _token The ERC20 token to be used.
   * @param _bondStartBlock The block number on or after which the deposit can be made to Compound
   * @param _bondEndBlock The block number on or after which the Compound supply can be withdrawn
   */
  constructor (
    IMoneyMarket _moneyMarket,
    IERC20 _token,
    uint256 _bondStartBlock,
    uint256 _bondEndBlock,
    uint256 _ticketPrice
  ) public {
    require(address(_moneyMarket) != address(0), "money market address cannot be zero");
    require(address(_token) != address(0), "token address cannot be zero");
    moneyMarket = _moneyMarket;
    token = _token;
    bondStartBlock = _bondStartBlock;
    bondEndBlock = _bondEndBlock;
    ticketPrice = _ticketPrice;
  }

  function buyTickets (uint256 _count) external {
    uint256 remaining = _count;
    while (remaining > 0) {
      buyTicket();
      remaining -= 1;
    }

    emit BoughtTickets(msg.sender, _count);
  }

  /**
   * @notice Buys a lottery ticket.  Only possible while the Lottery is in the "open" state.  The
   * user can buy any number of tickets.  Each ticket is a chance at winning.
   */
  function buyTicket () public requireOpen {
    require(token.transferFrom(msg.sender, address(this), ticketPrice), "token transfer failed");

    if (_hasEntry(msg.sender)) {
      entries[msg.sender].amount = entries[msg.sender].amount.add(ticketPrice);
      entries[msg.sender].ticketCount = entries[msg.sender].ticketCount.add(1);
    } else {
      entries[msg.sender] = Entry(
        msg.sender,
        ticketPrice,
        1
      );
    }

    ticketAddresses.push(msg.sender);

    totalAmount = totalAmount.add(ticketPrice);

    emit BoughtTicket(msg.sender, ticketPrice);
  }

  /**
   * @notice Pools the deposits and supplies them to Compound.  Can only be called after the bond start time.
   * Fires the LotteryLocked event.
   */
  function lock(bytes32 _secretHash) external requireOpen {
    if (msg.sender != owner()) {
      require(bondStartBlock < block.number, "lottery cannot be locked yet");
    } else if (block.number != bondStartBlock) {
      bondStartBlock = block.number;
    }
    require(_secretHash != 0, "secret hash must be defined");
    secretHash = _secretHash;
    state = State.LOCKED;
    require(token.approve(address(moneyMarket), totalAmount), "could not approve money market spend");
    require(moneyMarket.supply(address(token), totalAmount) == 0, "could not supply money market");

    emit LotteryLocked();
  }

  /**
   * @notice Withdraws the deposit from Compound and selects a winner.  Fires the LotteryUnlocked event.
   */
  function unlock(bytes32 _secret) public requireLocked {
    if (msg.sender != owner()) {
      require(bondEndBlock < block.number, "lottery cannot be unlocked yet");
    } else if (block.number != bondEndBlock) {
      bondEndBlock = block.number;
    }
    require(keccak256(abi.encodePacked(_secret)) == secretHash, "secret does not match");
    secret = _secret;
    state = State.COMPLETE;
    uint256 balance = moneyMarket.getSupplyBalance(address(this), address(token));
    if (balance > 0) {
      require(moneyMarket.withdraw(address(token), balance) == 0, "could not withdraw balance");
    }
    finalAmount = balance;

    emit LotteryUnlocked();
  }

  /**
   * @notice Transfers a users deposit, and potential winnings, back to them.  The Lottery must be unlocked.
   * The user must have deposited funds.  Fires the Withdrawn event.
   */
  function withdraw() public requireComplete {
    require(_hasEntry(msg.sender), "entrant exists");
    Entry storage entry = entries[msg.sender];
    require(entry.amount > 0, "entrant has already withdrawn");
    uint256 winningTotal = winnings(msg.sender);
    delete entry.amount;

    emit Withdrawn(msg.sender);

    require(token.transfer(msg.sender, winningTotal), "could not transfer winnings");
  }

  /**
   * @notice Calculates a user's winnings.  This is their deposit plus their winnings, if any.
   * @param _addr The address of the user
   */
  function winnings(address _addr) public view returns (uint256) {
    Entry storage entry = entries[_addr];
    if (entry.amount == 0) {
      return 0;
    }
    uint256 winningTotal = entry.amount;
    address winnerAddress = ticketAddresses[winnerIndex()];
    if (state == State.COMPLETE && _addr == winnerAddress) {
      winningTotal = winningTotal.add(finalAmount.sub(totalAmount));
    }
    return winningTotal;
  }

  function winnerIndex() internal view returns (uint256) {
    if (ticketAddresses.length == 0) {
      return 0;
    } else {
      return _selectRandom(ticketAddresses.length);
    }
  }

  function _selectRandom(uint256 total) internal view returns (uint256) {
    return UniformRandomNumber.uniform(_entropy(), total);
  }

  function _entropy() internal view returns (uint256) {
    return uint256(blockhash(bondEndBlock) ^ secret);
  }

  /**
   * @notice Retrieves information about the lottery.
   * @return A tuple containing: entryTotal (the total of all deposits), startTime (the timestamp after which
   * the lottery can be locked), endTime (the time after which the lottery can be unlocked), lotteryState
   * (either OPEN, LOCKED, COMPLETE), winner (the address of the winner), supplyBalanceTotal (the total
   * deposits plus any interest from Compound), minDeposit (the minimum deposit required).
   */
  function getInfo() public view returns (
    uint256 entryTotal,
    uint256 startTime,
    uint256 endTime,
    State lotteryState,
    address winner,
    uint256 supplyBalanceTotal,
    uint256 minDeposit
  ) {
    address winAddr = address(0);
    if (state == State.COMPLETE && ticketAddresses.length > 0) {
      winAddr = ticketAddresses[winnerIndex()];
    }
    return (
      totalAmount,
      bondStartBlock,
      bondEndBlock,
      state,
      winAddr,
      finalAmount,
      ticketPrice
    );
  }

  /**
   * @notice Retrieves information about a user's entry in the Lottery.
   * @return addr (the address of the user), amount (the amount they deposited)
   */
  function getEntry(address _addr) public view returns (
    address addr,
    uint256 amount,
    uint256 ticketCount
  ) {
    Entry storage entry = entries[_addr];
    return (
      entry.addr,
      entry.amount,
      entry.ticketCount
    );
  }

  function _hasEntry(address _addr) internal view returns (bool) {
    return entries[_addr].addr == _addr;
  }

  modifier requireOpen() {
    require(state == State.OPEN, "state is not open");
    _;
  }

  modifier requireLocked() {
    require(state == State.LOCKED, "state is not locked");
    _;
  }

  modifier requireComplete() {
    require(state == State.COMPLETE, "lottery is not complete");
    _;
  }
}
