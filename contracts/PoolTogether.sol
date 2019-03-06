pragma solidity ^0.5.0;

import "openzeppelin-eth/contracts/math/SafeMath.sol";
import "openzeppelin-eth/contracts/token/ERC20/IERC20.sol";
import "zos-lib/contracts/Initializable.sol";
import "./compound/IMoneyMarket.sol";

contract PoolTogether is Initializable {
  using SafeMath for uint256;

  uint public constant MAX_UINT = 2**256 - 1;

  event Deposited(uint256 lotteryId, address indexed sender, uint256 amount);
  event LotteryCreated(uint256 lotteryId);
  event LotteryLocked(uint256 lotteryId);
  event LotteryUnlocked(uint256 lotteryId);

  enum LotteryState {
    OPEN,
    LOCKED,
    COMPLETE
  }

  struct Lottery {
    uint256 id;
    uint256 totalAmount;
    uint256 bondStartTime;
    uint256 bondEndTime;
    LotteryState state;
    uint256 winnerIndex;
    uint256 finalAmount;
    address[] entryAddresses;
    mapping (address => Entry) entries;
    mapping (address => uint256) entryAddressIndices;
  }

  struct Entry {
    address addr;
    uint256 amount;
  }

  IMoneyMarket moneyMarket;
  IERC20 token;
  Lottery[] lotteries;
  uint256 openDuration;
  uint256 bondDuration;

  function initialize (address _token, address _moneyMarket, uint256 _openDuration, uint256 _bondDuration) public initializer {
    require(_token != address(0), "token is not defined");
    token = IERC20(_token);
    require(_moneyMarket != address(0), "money market is not defined");
    moneyMarket = IMoneyMarket(_moneyMarket);
    openDuration = _openDuration;
    bondDuration = _bondDuration;
  }

  function deposit (uint256 _amount) requireCurrentLotteryOpen external {
    require(_amount > 0, "amount is zero");
    require(address(token) != address(0), "token is zeroooo");
    require(token.transferFrom(msg.sender, address(this), _amount), "token transfer failed");

    Lottery storage lottery = _currentLottery();

    if (_hasEntry(lottery, msg.sender)) {
      lottery.entries[msg.sender].amount = lottery.entries[msg.sender].amount.add(_amount);
    } else {
      uint256 index = lottery.entryAddresses.length;
      lottery.entryAddresses.push(msg.sender);
      lottery.entryAddressIndices[msg.sender] = index;
      lottery.entries[msg.sender] = Entry(
        msg.sender,
        _amount
      );
    }

    lottery.totalAmount = lottery.totalAmount.add(_amount);

    emit Deposited(lottery.id, msg.sender, _amount);
  }

  function createLottery() external {
    bool canCreateLottery = lotteries.length == uint256(0) || _currentLottery().state == LotteryState.COMPLETE;
    require(canCreateLottery, "the last lottery has not completed");
    address[] memory entries;
    uint256 id = lotteries.length;
    lotteries.push(Lottery(
      id,
      0,
      now + openDuration,
      now + openDuration + bondDuration,
      LotteryState.OPEN,
      0,
      0,
      entries
    ));

    emit LotteryCreated(id);
  }

  function lockLottery() requireCurrentLotteryOpen external {
    Lottery storage lottery = _currentLottery();
    require(lottery.bondStartTime <= now, "lottery cannot be locked yet");
    lottery.state = LotteryState.LOCKED;
    require(token.approve(address(moneyMarket), lottery.totalAmount), "could not approve money market spend");
    require(moneyMarket.supply(address(token), lottery.totalAmount) == 0, "could not supply money market");

    emit LotteryLocked(lottery.id);
  }

  function unlockLottery(uint256 _lotteryId) requireLotteryExists(_lotteryId) public {
    Lottery storage lottery = lotteries[_lotteryId];
    require(lottery.bondEndTime <= now, "lottery cannot be unlocked yet");
    lottery.state = LotteryState.COMPLETE;
    uint256 balance = moneyMarket.getSupplyBalance(address(this), address(token));
    require(moneyMarket.withdraw(address(token), balance) == 0, "could not withdraw balance");
    lottery.finalAmount = balance;
    lottery.winnerIndex = _selectRandom(lottery.entryAddresses.length);

    emit LotteryUnlocked(lottery.id);
  }

  function withdraw(uint256 _lotteryId) requireLotteryExists(_lotteryId) public {
    Lottery storage lottery = lotteries[_lotteryId];
    require(lottery.state == LotteryState.COMPLETE, "lottery has completed");
    require(_hasEntry(lottery, msg.sender), "entrant exists");
    Entry storage entry = lottery.entries[msg.sender];
    require(entry.amount > 0, "entrant has already withdrawn");
    uint256 winningTotal = winnings(_lotteryId, msg.sender);
    delete entry.amount;
    require(token.transfer(msg.sender, winningTotal), "could not transfer winnings");
  }

  function winnings(uint256 _lotteryId, address _addr) requireLotteryExists(_lotteryId) public view returns (uint256) {
    Lottery storage lottery = lotteries[_lotteryId];
    require(_hasEntry(lottery, _addr), "entrant exists");
    Entry storage entry = lottery.entries[_addr];
    if (entry.amount == 0) {
      return 0;
    }
    uint256 entryIndex = lottery.entryAddressIndices[_addr];
    uint256 winningTotal = entry.amount;
    if (entryIndex == lottery.winnerIndex) {
      winningTotal = winningTotal.add(lottery.finalAmount.sub(lottery.totalAmount));
    }
    return winningTotal;
  }

  function getLottery(uint256 _lotteryId) public view returns (
    uint256 id,
    uint256 totalAmount,
    uint256 bondStartTime,
    uint256 bondEndTime,
    LotteryState state,
    uint256 winnerIndex,
    uint256 finalAmount
  ) {
    require(lotteries.length > _lotteryId, "lottery does not exist");
    Lottery storage lottery = lotteries[_lotteryId];
    return (
      lottery.id,
      lottery.totalAmount,
      lottery.bondStartTime,
      lottery.bondEndTime,
      lottery.state,
      lottery.winnerIndex,
      lottery.finalAmount
    );
  }

  function getEntry(uint256 _lotteryId, address _addr) public view returns (
    address addr,
    uint256 amount
  ) {
    require(lotteries.length > _lotteryId, "lottery does not exist");
    Lottery storage lottery = lotteries[_lotteryId];
    require(_hasEntry(lottery, _addr), "address has no entry");
    Entry storage entry = lottery.entries[_addr];
    return (
      entry.addr,
      entry.amount
    );
  }

  function _hasEntry(Lottery storage _lottery, address _addr) internal view returns (bool) {
    uint256 entryAddressIndex = _lottery.entryAddressIndices[_addr];
    return _lottery.entryAddresses.length > entryAddressIndex && _lottery.entryAddresses[entryAddressIndex] == _addr;
  }

  function _currentLottery() requireCurrentLottery internal view returns (Lottery storage) {
    return lotteries[lotteries.length - 1];
  }

  modifier requireLotteryExists(uint256 _lotteryId) {
    require(lotteries.length > _lotteryId, "lottery does not exist");
    _;
  }

  modifier requireCurrentLottery() {
    require(lotteries.length > 0, "a lottery does not exist");
    _;
  }

  modifier requireCurrentLotteryOpen() {
    require(_currentLottery().state == LotteryState.OPEN, "no open lottery");
    _;
  }

  function _selectRandom(uint256 total) internal view returns (uint256) {
    uint256 bucketSize = MAX_UINT / total;
    uint256 randomUint = uint256(_entropy());
    return randomUint / bucketSize;
  }

  function _entropy() internal view returns (bytes32) {
    return blockhash(block.number - 1) ^ blockhash(block.number - 2) ^ blockhash(block.number - 3) ^ blockhash(block.number - 4);
  }
}
