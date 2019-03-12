pragma solidity ^0.5.0;

import "openzeppelin-eth/contracts/token/ERC20/IERC20.sol";
import "./compound/IMoneyMarket.sol";
import "openzeppelin-eth/contracts/math/SafeMath.sol";
import "openzeppelin-eth/contracts/ownership/Ownable.sol";

/**
 * @title The Lottery contract for PoolTogether
 * @author Brendan Asselstine
 * @notice This contract will accept deposits, use the pool the deposits together to supply the Compound
 * contract, then withdraw the amount plus interest and pay the interest to the lottery winner.
 */
contract Lottery is Ownable {
  using SafeMath for uint256;

  uint public constant MAX_UINT = 2**256 - 1;

  event Deposited(address indexed sender, uint256 amount);
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
  }

  uint256 private totalAmount;
  uint256 private bondStartTime;
  uint256 private bondEndTime;
  State public state;
  uint256 private winnerIndex;
  uint256 private finalAmount;
  address[] private entryAddresses;
  mapping (address => Entry) private entries;
  mapping (address => uint256) private entryAddressIndices;
  IMoneyMarket public moneyMarket;
  IERC20 public token;

  /**
   * @notice Creates a new Lottery.
   * @param _moneyMarket The Compound money market to supply tokens to.
   * @param _token The ERC20 token to be used.
   * @param _bondStartTime The timestamp after which the deposit can be made to Compound
   * @param _bondEndTime The timestamp after which the Compound supply can be withdrawn
   */
  constructor (
    IMoneyMarket _moneyMarket,
    IERC20 _token,
    uint256 _bondStartTime,
    uint256 _bondEndTime
  ) public {
    require(address(_moneyMarket) != address(0), "money market address cannot be zero");
    require(address(_token) != address(0), "token address cannot be zero");
    moneyMarket = _moneyMarket;
    token = _token;
    bondStartTime = _bondStartTime;
    bondEndTime = _bondEndTime;
  }

  /**
   * @notice Deposits tokens into the Lottery.  Only possible before the Lottery deposits into Compound.  The
   * user can deposit any number of times, but they will always have the same chance of winning.
   * @param _amount The amount of the configured token to deposit.
   */
  function deposit (uint256 _amount) requireOpen external {
    require(_amount > 0, "amount is zero");
    require(address(token) != address(0), "token is zeroooo");
    require(token.transferFrom(msg.sender, address(this), _amount), "token transfer failed");

    if (_hasEntry(msg.sender)) {
      entries[msg.sender].amount = entries[msg.sender].amount.add(_amount);
    } else {
      uint256 index = entryAddresses.length;
      entryAddresses.push(msg.sender);
      entryAddressIndices[msg.sender] = index;
      entries[msg.sender] = Entry(
        msg.sender,
        _amount
      );
    }

    totalAmount = totalAmount.add(_amount);

    emit Deposited(msg.sender, _amount);
  }

  /**
   * @notice Pools the deposits and supplies them to Compound.  Can only be called after the bond start time.
   * Fires the LotteryLocked event.
   */
  function lock() requireOpen external {
    require(bondStartTime <= now, "lottery cannot be locked yet");
    state = State.LOCKED;
    require(token.approve(address(moneyMarket), totalAmount), "could not approve money market spend");
    require(moneyMarket.supply(address(token), totalAmount) == 0, "could not supply money market");

    emit LotteryLocked();
  }

  /**
   * @notice Withdraws the deposit from Compound and selects a winner.  Fires the LotteryUnlocked event.
   */
  function unlock() requireLocked public {
    if (msg.sender != owner()) {
      require(bondEndTime < now, "lottery cannot be unlocked yet");
    }
    state = State.COMPLETE;
    uint256 balance = moneyMarket.getSupplyBalance(address(this), address(token));
    require(moneyMarket.withdraw(address(token), balance) == 0, "could not withdraw balance");
    finalAmount = balance;
    if (entryAddresses.length == 0) {
      winnerIndex = 0;
    } else {
      winnerIndex = _selectRandom(entryAddresses.length);
    }

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
    uint256 entryIndex = entryAddressIndices[_addr];
    uint256 winningTotal = entry.amount;
    if (state == State.COMPLETE && entryIndex == winnerIndex) {
      winningTotal = winningTotal.add(finalAmount.sub(totalAmount));
    }
    return winningTotal;
  }

  function _selectRandom(uint256 total) internal view returns (uint256) {
    uint256 bucketSize = MAX_UINT / total;
    uint256 randomUint = uint256(_entropy());
    return randomUint / bucketSize;
  }

  function _entropy() internal view returns (bytes32) {
    return blockhash(block.number - 1) ^ blockhash(block.number - 2) ^ blockhash(block.number - 3) ^ blockhash(block.number - 4);
  }

  /**
   * @notice Retrieves information about the lottery.
   * @return A tuple containing: entryTotal (the total of all deposits), startTime (the timestamp after which
   * the lottery can be locked), endTime (the time after which the lottery can be unlocked), lotteryState
   * (either OPEN, LOCKED, COMPLETE), winner (the address of the winner), supplyBalanceTotal (the total
   * deposits plus any interest from Compound).
   */
  function getInfo() public view returns (
    uint256 entryTotal,
    uint256 startTime,
    uint256 endTime,
    State lotteryState,
    address winner,
    uint256 supplyBalanceTotal
  ) {
    address winAddr = address(0);
    if (finalAmount != 0 && entryAddresses.length > 0) {
      winAddr = entryAddresses[winnerIndex];
    }
    return (
      totalAmount,
      bondStartTime,
      bondEndTime,
      state,
      winAddr,
      finalAmount
    );
  }

  /**
   * @notice Retrieves information about a user's entry in the Lottery.
   * @return addr (the address of the user), amount (the amount they deposited)
   */
  function getEntry(address _addr) public view returns (
    address addr,
    uint256 amount
  ) {
    Entry storage entry = entries[_addr];
    return (
      entry.addr,
      entry.amount
    );
  }

  function _hasEntry(address _addr) internal view returns (bool) {
    uint256 entryAddressIndex = entryAddressIndices[_addr];
    return entryAddresses.length > entryAddressIndex && entryAddresses[entryAddressIndex] == _addr;
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
