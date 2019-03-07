pragma solidity ^0.5.0;

import "openzeppelin-eth/contracts/token/ERC20/IERC20.sol";
import "./compound/IMoneyMarket.sol";
import "openzeppelin-eth/contracts/math/SafeMath.sol";

contract Lottery {
  using SafeMath for uint256;

  uint public constant MAX_UINT = 2**256 - 1;

  event Deposited(address indexed sender, uint256 amount);
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

  function lock() requireOpen external {
    require(bondStartTime <= now, "lottery cannot be locked yet");
    state = State.LOCKED;
    require(token.approve(address(moneyMarket), totalAmount), "could not approve money market spend");
    require(moneyMarket.supply(address(token), totalAmount) == 0, "could not supply money market");

    emit LotteryLocked();
  }

  function unlock() public {
    require(bondEndTime < now, "lottery cannot be unlocked yet");
    state = State.COMPLETE;
    uint256 balance = moneyMarket.getSupplyBalance(address(this), address(token));
    require(moneyMarket.withdraw(address(token), balance) == 0, "could not withdraw balance");
    finalAmount = balance;
    winnerIndex = _selectRandom(entryAddresses.length);

    emit LotteryUnlocked();
  }

  function withdraw() public {
    require(state == State.COMPLETE, "lottery has completed");
    require(_hasEntry(msg.sender), "entrant exists");
    Entry storage entry = entries[msg.sender];
    require(entry.amount > 0, "entrant has already withdrawn");
    uint256 winningTotal = winnings(msg.sender);
    delete entry.amount;
    require(token.transfer(msg.sender, winningTotal), "could not transfer winnings");
  }

  function winnings(address _addr) public view returns (uint256) {
    require(_hasEntry(_addr), "entrant exists");
    Entry storage entry = entries[_addr];
    if (entry.amount == 0) {
      return 0;
    }
    uint256 entryIndex = entryAddressIndices[_addr];
    uint256 winningTotal = entry.amount;
    if (entryIndex == winnerIndex) {
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

  function getEntry(address _addr) public view returns (
    address addr,
    uint256 amount
  ) {
    require(_hasEntry(_addr), "address has no entry");
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
}
