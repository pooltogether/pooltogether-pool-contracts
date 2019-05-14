pragma solidity ^0.5.0;

import "openzeppelin-eth/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-eth/contracts/math/SafeMath.sol";
import "./compound/IMoneyMarket.sol";
import "openzeppelin-eth/contracts/ownership/Ownable.sol";
import "kleros/contracts/data-structures/SortitionSumTreeFactory.sol";
import "./UniformRandomNumber.sol";
import "fixidity/contracts/FixidityLib.sol";

/**
 * @title The Lottery contract for PoolTogether
 * @author Brendan Asselstine
 * @notice This contract implements a "lossless lottery".  The lottery exists in three states: open, locked, and complete.
 * The lottery begins in the open state during which users can buy any number of tickets.  The more tickets they purchase, the greater their chances of winning.
 * After the bondStartBlock the owner may lock the lottery.  The lottery transfers the pool of ticket money into the Compound Finance MoneyMarket and no more tickets are sold.
 * After the bondEndBlock the owner may unlock the lottery.  The lottery will withdraw the ticket money from the MoneyMarket, plus earned interest, back into the contract.  The fee will be sent to
 * the owner, and users will be able to withdraw their ticket money and winnings, if any.
 * @dev All monetary values are stored internally as fixed point 24.
 */
contract Lottery is Ownable {
  using SafeMath for uint256;

  event BoughtTickets(address indexed sender, int256 count, uint256 totalPrice);
  event Withdrawn(address indexed sender, int256 amount);
  event OwnerWithdrawn(address indexed sender, int256 amount);
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

  bytes32 public constant SUM_TREE_KEY = "PoolLottery";

  int256 private totalAmount; // fixed point 24
  uint256 private bondStartBlock;
  uint256 private bondEndBlock;
  bytes32 private secretHash;
  bytes32 private secret;
  State public state;
  int256 private finalAmount; //fixed point 24
  mapping (address => Entry) private entries;
  uint256 public entryCount;
  IMoneyMarket public moneyMarket;
  IERC20 public token;
  int256 private ticketPrice; //fixed point 24
  int256 private feeFraction; //fixed point 24
  bool private ownerHasWithdrawn;

  using SortitionSumTreeFactory for SortitionSumTreeFactory.SortitionSumTrees;
  SortitionSumTreeFactory.SortitionSumTrees internal sortitionSumTrees;

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
    int256 _feeFractionFixedPoint18
  ) public {
    require(_bondEndBlock > _bondStartBlock, "bond end block is not after start block");
    require(address(_moneyMarket) != address(0), "money market address cannot be zero");
    require(address(_token) != address(0), "token address cannot be zero");
    require(_ticketPrice > 0, "ticket price must be greater than zero");
    require(_feeFractionFixedPoint18 >= 0, "fee must be zero or greater");
    require(_feeFractionFixedPoint18 <= 1000000000000000000, "fee fraction must be less than 1");
    feeFraction = FixidityLib.newFixed(_feeFractionFixedPoint18, uint8(18));
    ticketPrice = FixidityLib.newFixed(_ticketPrice);
    sortitionSumTrees.createTree(SUM_TREE_KEY, 4);

    moneyMarket = _moneyMarket;
    token = _token;
    bondStartBlock = _bondStartBlock;
    bondEndBlock = _bondEndBlock;
  }

  /**
   * @notice Buys a lottery ticket.  Only possible while the Lottery is in the "open" state.  The
   * user can buy any number of tickets.  Each ticket is a chance at winning.
   */
  function buyTickets (int256 _count) public requireOpen {
    require(_count > 0, "number of tickets is less than or equal to zero");
    int256 countFixed = FixidityLib.newFixed(_count);
    int256 totalDeposit = FixidityLib.multiply(ticketPrice, countFixed);
    uint256 totalDepositNonFixed = uint256(FixidityLib.fromFixed(totalDeposit));
    require(token.transferFrom(msg.sender, address(this), totalDepositNonFixed), "token transfer failed");

    if (_hasEntry(msg.sender)) {
      entries[msg.sender].amount = FixidityLib.add(entries[msg.sender].amount, totalDeposit);
      entries[msg.sender].ticketCount = entries[msg.sender].ticketCount.add(uint256(_count));
    } else {
      entries[msg.sender] = Entry(
        msg.sender,
        totalDeposit,
        uint256(_count)
      );
      entryCount = entryCount.add(1);
    }

    sortitionSumTrees.set(SUM_TREE_KEY, totalDepositNonFixed, bytes32(uint256(msg.sender)));

    totalAmount = FixidityLib.add(totalAmount, totalDeposit);

    // the total amount cannot exceed the max lottery size
    require(totalAmount < maxLotterySizeFixedPoint24(FixidityLib.maxFixedDiv()), "lottery size exceeds maximum");

    emit BoughtTickets(msg.sender, _count, totalDepositNonFixed);
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
    int256 totalAmountNonFixed = FixidityLib.fromFixed(totalAmount);
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
    finalAmount = FixidityLib.newFixed(int256(balance));

    require(token.transfer(owner(), feeAmount()), "could not transfer winnings");

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

    emit Withdrawn(msg.sender, winningTotal);

    require(token.transfer(msg.sender, uint256(winningTotal)), "could not transfer winnings");
  }

  /**
   * @notice Calculates a user's winnings.  This is their deposit plus their winnings, if any.
   * @param _addr The address of the user
   */
  function winnings(address _addr) public view returns (int256) {
    Entry storage entry = entries[_addr];
    if (entry.addr == address(0)) { //if does not have an entry
      return 0;
    }
    int256 winningTotal = entry.amount;
    if (state == State.COMPLETE && _addr == winnerAddress()) {
      winningTotal = FixidityLib.add(winningTotal, netWinningsFixedPoint24());
    }
    return FixidityLib.fromFixed(winningTotal);
  }

  /**
   * @notice Selects and returns the winner's address
   * @return The winner's address
   */
  function winnerAddress() public view returns (address) {
    return address(uint256(sortitionSumTrees.draw(SUM_TREE_KEY, randomToken())));
  }

  function netWinningsFixedPoint24() internal view returns (int256) {
    return grossWinningsFixedPoint24() - feeAmountFixedPoint24();
  }

  function grossWinningsFixedPoint24() internal view returns (int256) {
    if (state == State.COMPLETE) {
      return FixidityLib.subtract(finalAmount, totalAmount);
    } else {
      return 0;
    }
  }

  /**
   * @notice Calculates the size of the fee based on the gross winnings
   * @return The fee for the lottery to be transferred to the owner
   */
  function feeAmount() public view returns (uint256) {
    return uint256(FixidityLib.fromFixed(feeAmountFixedPoint24()));
  }

  function feeAmountFixedPoint24() internal view returns (int256) {
    return FixidityLib.multiply(grossWinningsFixedPoint24(), feeFraction);
  }

  function randomToken() internal view returns (uint256) {
    if (block.number > bondEndBlock) {
      return 0;
    } else {
      return _selectRandom(uint256(FixidityLib.fromFixed(totalAmount)));
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
    int256 ticketCost,
    uint256 participantCount,
    int256 maxLotterySize,
    int256 estimatedInterest
  ) {
    address winAddr = address(0);
    if (state == State.COMPLETE) {
      winAddr = winnerAddress();
    }
    return (
      FixidityLib.fromFixed(totalAmount),
      bondStartBlock,
      bondEndBlock,
      state,
      winAddr,
      FixidityLib.fromFixed(finalAmount),
      FixidityLib.fromFixed(ticketPrice),
      entryCount,
      FixidityLib.fromFixed(maxLotterySizeFixedPoint24(FixidityLib.maxFixedDiv())),
      FixidityLib.fromFixed(currentInterestFractionFixedPoint24())
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
      FixidityLib.fromFixed(entry.amount),
      entry.ticketCount
    );
  }

  /**
   * @notice Calculates the maximum lottery size so that it doesn't overflow after earning interest
   * @dev lotterySize = totalDeposits + totalDeposits * interest => totalDeposits = lotterySize / (1 + interest)
   * @return The maximum size of the lottery to be deposited into the MoneyMarket
   */
  function maxLotterySizeFixedPoint24(int256 _maxValueFixedPoint24) public view returns (int256) {
    /// Double the interest rate in case it increases over the bond period.  Somewhat arbitrarily.
    int256 interestFraction = FixidityLib.multiply(currentInterestFractionFixedPoint24(), FixidityLib.newFixed(2));
    return FixidityLib.divide(_maxValueFixedPoint24, FixidityLib.add(interestFraction, FixidityLib.newFixed(1)));
  }

  /**
   * @notice Estimates the current effective interest rate using the MoneyMarket's current supplyRateMantissa and the lock duration in blocks.
   * @return The current estimated effective interest rate
   */
  function currentInterestFractionFixedPoint24() public view returns (int256) {
    int256 blockDuration = int256(bondEndBlock - bondStartBlock);
    int256 supplyRateMantissaFixedPoint24 = FixidityLib.newFixed(int256(supplyRateMantissa()), uint8(18));
    return FixidityLib.multiply(supplyRateMantissaFixedPoint24, FixidityLib.newFixed(blockDuration));
  }

  /**
   * @notice Extracts the supplyRateMantissa value from the MoneyMarket contract
   * @return The MoneyMarket supply rate per block
   */
  function supplyRateMantissa() public view returns (uint256) {
    (,,,,uint __supplyRateMantissa,,,,) = moneyMarket.markets(address(token));
    return __supplyRateMantissa;
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
