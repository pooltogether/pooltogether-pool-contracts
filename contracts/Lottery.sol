pragma solidity ^0.5.0;

import "openzeppelin-eth/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-eth/contracts/math/SafeMath.sol";
import "./compound/IMoneyMarket.sol";
import "openzeppelin-eth/contracts/ownership/Ownable.sol";
import "./UniformRandomNumber.sol";
import "./Fixidity.sol";

// to get APR divide 

/**
 * @title The Lottery contract for PoolTogether
 * @author Brendan Asselstine
 * @notice This contract pools deposits together  accept deposits, use the pool the deposits together to supply the Compound
 * contract, then withdraw the amount plus interest and pay the interest to the lottery winner.
 * @dev All monetary values are stored internally as fixed point 24
 */
contract Lottery is Ownable {
  using SafeMath for uint256;

  event BoughtTicket(address indexed sender, int256 amount);
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
    int256 amount;
    uint256 ticketCount;
  }

  int256 private totalAmount; // fixed point 24
  uint256 private bondStartBlock;
  uint256 private bondEndBlock;
  bytes32 private secretHash;
  bytes32 private secret;
  State public state;
  int256 private finalAmount; //fixed point 24
  address[] private ticketAddresses;
  mapping (address => Entry) private entries;
  IMoneyMarket public moneyMarket;
  IERC20 public token;
  int256 private ticketPrice; //fixed point 24
  int256 private feeFraction; //fixed point 24
  Fixidity fixidity;

  /**
   * @notice Creates a new Lottery.
   * @param _moneyMarket The Compound money market to supply tokens to.
   * @param _token The ERC20 token to be used.
   * @param _bondStartBlock The block number on or after which the deposit can be made to Compound
   * @param _bondEndBlock The block number on or after which the Compound supply can be withdrawn
   * @param _ticketPrice The price of each ticket (fixed point 18)
   * @param _feeFractionFixedPoint18 The fraction of the winnings going to the owner (fixed point 18)
   */
  constructor (
    IMoneyMarket _moneyMarket,
    IERC20 _token,
    uint256 _bondStartBlock,
    uint256 _bondEndBlock,
    int256 _ticketPrice,
    int256 _feeFractionFixedPoint18,
    Fixidity _fixidity
  ) public {
    require(_bondEndBlock > _bondStartBlock, "bond end block is not after start block");
    require(address(_moneyMarket) != address(0), "money market address cannot be zero");
    require(address(_token) != address(0), "token address cannot be zero");
    require(address(_fixidity) != address(0), "fixidity must be defined");
    require(_ticketPrice > 0, "ticket price must be greater than zero");
    require(_feeFractionFixedPoint18 >= 0, "fee must be zero or greater");
    require(_feeFractionFixedPoint18 <= 1000000000000000000, "fee fraction must be less than 1");
    fixidity = _fixidity;
    feeFraction = fixidity.newFixed(_feeFractionFixedPoint18, uint8(18));
    ticketPrice = fixidity.newFixed(_ticketPrice);

    moneyMarket = _moneyMarket;
    token = _token;
    bondStartBlock = _bondStartBlock;
    bondEndBlock = _bondEndBlock;
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
    int256 nonFixedTicketPrice = fixidity.fromFixed(ticketPrice);
    require(token.transferFrom(msg.sender, address(this), uint256(nonFixedTicketPrice)), "token transfer failed");

    if (_hasEntry(msg.sender)) {
      entries[msg.sender].amount = fixidity.add(entries[msg.sender].amount, ticketPrice);
      entries[msg.sender].ticketCount = entries[msg.sender].ticketCount.add(1);
    } else {
      entries[msg.sender] = Entry(
        msg.sender,
        ticketPrice,
        1
      );
    }

    ticketAddresses.push(msg.sender);

    totalAmount = fixidity.add(totalAmount, ticketPrice);

    // the total amount cannot exceed the max lottery size
    require(totalAmount < maxLotterySize(), "lottery size exceeds maximum");

    emit BoughtTicket(msg.sender, nonFixedTicketPrice);
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
    int256 totalAmountNonFixed = fixidity.fromFixed(totalAmount);
    require(token.approve(address(moneyMarket), uint256(totalAmountNonFixed)), "could not approve money market spend");
    require(moneyMarket.supply(address(token), uint256(totalAmountNonFixed)) == 0, "could not supply money market");

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
    finalAmount = fixidity.newFixed(int256(balance));

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
    int256 winningTotal = winnings(msg.sender);
    delete entry.amount;

    emit Withdrawn(msg.sender);

    require(token.transfer(msg.sender, uint256(winningTotal)), "could not transfer winnings");
  }

  /**
   * @notice Calculates a user's winnings.  This is their deposit plus their winnings, if any.
   * @param _addr The address of the user
   */
  function winnings(address _addr) public view returns (int256) {
    Entry storage entry = entries[_addr];
    if (entry.amount == 0) {
      return 0;
    }
    int256 winningTotal = entry.amount;
    address winnerAddress = ticketAddresses[winnerIndex()];
    if (state == State.COMPLETE && _addr == winnerAddress) {
      winningTotal = fixidity.subtract(fixidity.add(winningTotal, finalAmount), totalAmount);
    }
    return fixidity.fromFixed(winningTotal);
  }

  function interestEarned() public view returns (int256) {
    if (state == State.COMPLETE) {
      return fixidity.subtract(finalAmount, totalAmount);
    } else {
      return 0;
    }
  }

  function feeAmount() public view returns (uint256) {
    // int256 interestEarnedFixedPoint24 = fixidity.newFixed(interestEarned(), uint8(0));
    // fixidity.multiply(feeFractionFixedPoint24, interestEarnedFixedPoint24);
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
    int256 entryTotal,
    uint256 startTime,
    uint256 endTime,
    State lotteryState,
    address winner,
    int256 supplyBalanceTotal,
    int256 ticketCost
  ) {
    address winAddr = address(0);
    if (state == State.COMPLETE && ticketAddresses.length > 0) {
      winAddr = ticketAddresses[winnerIndex()];
    }
    return (
      fixidity.fromFixed(totalAmount),
      bondStartBlock,
      bondEndBlock,
      state,
      winAddr,
      fixidity.fromFixed(finalAmount),
      fixidity.fromFixed(ticketPrice)
    );
  }

  /**
   * @notice Retrieves information about a user's entry in the Lottery.
   * @return addr (the address of the user), amount (the amount they deposited)
   */
  function getEntry(address _addr) public view returns (
    address addr,
    int256 amount,
    uint256 ticketCount
  ) {
    Entry storage entry = entries[_addr];
    return (
      entry.addr,
      fixidity.fromFixed(entry.amount),
      entry.ticketCount
    );
  }

  /// @notice Calculates the maximum lottery size so that it won't overflow.  Based on block duration and moneyMarket rate.
  function maxLotterySize() public view returns (int256) {
    return maxLotterySize(fixidity.maxFixedDiv());
  }

  function maxLotterySize(int256 _maxFixedDiv) public view returns (int256) {
    return fixidity.divide(_maxFixedDiv, fixidity.add(currentInterestFractionFixedPoint24(), fixidity.newFixed(1)));
  }

  function currentInterestFractionFixedPoint24() public view returns (int256) {
    int256 blockDuration = int256(bondEndBlock - bondStartBlock);
    (,,,,uint supplyRateMantissa,,,,) = moneyMarket.markets(address(token));
    int256 supplyRateMantissaFixedPoint24 = fixidity.newFixed(int256(supplyRateMantissa), uint8(18));
    return fixidity.multiply(supplyRateMantissaFixedPoint24, blockDuration);
  }

  function toFixed(int256 _value) public view returns (int256) {
    return fixidity.newFixed(_value, uint8(18));
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
