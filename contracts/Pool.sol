pragma solidity ^0.5.0;

import "openzeppelin-eth/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-eth/contracts/math/SafeMath.sol";
import "./compound/ICErc20.sol";
import "openzeppelin-eth/contracts/ownership/Ownable.sol";
import "./UniformRandomNumber.sol";
import "./DrawManager.sol";
import "fixidity/contracts/FixidityLib.sol";

/**
 * @title The Pool contract for PoolTogether
 * @author Brendan Asselstine
 * @notice This contract implements a "lossless pool".  The pool exists in three states: open, locked, and complete.
 * The pool begins in the open state during which users can buy any number of tickets.  The more tickets they purchase, the greater their chances of winning.
 * After the lockStartBlock the owner may lock the pool.  The pool transfers the pool of ticket money into the Compound Finance money market and no more tickets are sold.
 * After the lockEndBlock the owner may unlock the pool.  The pool will withdraw the ticket money from the money market, plus earned interest, back into the contract.  The fee will be sent to
 * the owner, and users will be able to withdraw their ticket money and winnings, if any.
 * @dev All monetary values are stored internally as fixed point 24.
 */
contract Pool is Ownable {
  using DrawManager for DrawManager.DrawState;
  using SafeMath for uint256;

  /**
   * Emitted when "tickets" have been purchased.
   * @param sender The purchaser of the tickets
   * @param count The number of tickets purchased
   * @param totalPrice The total cost of the tickets
   */
  event BoughtTickets(address indexed sender, int256 count, uint256 totalPrice);

  /**
   * Emitted when a user withdraws from the pool.
   * @param sender The user that is withdrawing from the pool
   * @param amount The amount that the user withdrew
   */
  event Withdrawn(address indexed sender, int256 amount);

  /**
   * Emitted when the pool is locked.
   */
  event PoolLocked();

  /**
   * Emitted when the pool is unlocked.
   */
  event PoolUnlocked();

  /**
   * Emitted when the pool is complete
   */
  event PoolComplete(address indexed winner);

  enum State {
    OPEN,
    LOCKED,
    UNLOCKED,
    COMPLETE
  }

  struct Entry {
    address addr;
    int256 amount;
    uint256 ticketCount;
    int256 withdrawnNonFixed;
  }

  int256 private totalAmount; // fixed point 24
  uint256 private lockStartBlock;
  uint256 private lockEndBlock;
  bytes32 private secretHash;
  bytes32 private secret;
  State public state;
  int256 private finalAmount; //fixed point 24
  mapping (address => Entry) private entries;
  uint256 public entryCount;
  ICErc20 public moneyMarket;
  IERC20 public token;
  int256 private ticketPrice; //fixed point 24
  int256 private feeFraction; //fixed point 24
  bool private ownerHasWithdrawn;
  bool public allowLockAnytime;
  address private winningAddress;

  DrawManager.DrawState drawState;

  /**
   * @notice Creates a new Pool.
   * @param _moneyMarket The Compound money market to supply tokens to.
   * @param _token The ERC20 token to be used.
   * @param _lockStartBlock The block number on or after which the deposit can be made to Compound
   * @param _lockEndBlock The block number on or after which the Compound supply can be withdrawn
   * @param _ticketPrice The price of each ticket (fixed point 18)
   * @param _feeFractionFixedPoint18 The fraction of the winnings going to the owner (fixed point 18)
   */
  constructor (
    ICErc20 _moneyMarket,
    IERC20 _token,
    uint256 _lockStartBlock,
    uint256 _lockEndBlock,
    int256 _ticketPrice,
    int256 _feeFractionFixedPoint18,
    bool _allowLockAnytime
  ) public {
    require(_lockEndBlock > _lockStartBlock, "lock end block is not after start block");
    require(address(_moneyMarket) != address(0), "money market address cannot be zero");
    require(address(_token) != address(0), "token address cannot be zero");
    require(_ticketPrice > 0, "ticket price must be greater than zero");
    require(_feeFractionFixedPoint18 >= 0, "fee must be zero or greater");
    require(_feeFractionFixedPoint18 <= 1000000000000000000, "fee fraction must be less than 1");
    feeFraction = FixidityLib.newFixed(_feeFractionFixedPoint18, uint8(18));
    ticketPrice = FixidityLib.newFixed(_ticketPrice);
    drawState.openNextDraw();
    state = State.OPEN;
    moneyMarket = _moneyMarket;
    token = _token;
    lockStartBlock = _lockStartBlock;
    lockEndBlock = _lockEndBlock;
    allowLockAnytime = _allowLockAnytime;
  }

  /**
   * @notice Buys a pool ticket.  Only possible while the Pool is in the "open" state.  The
   * user can buy any number of tickets.  Each ticket is a chance at winning.
   * @param _countNonFixed The number of tickets the user wishes to buy.
   */
  function buyTickets (int256 _countNonFixed) public requireOpen {
    require(_countNonFixed > 0, "number of tickets is less than or equal to zero");
    int256 count = FixidityLib.newFixed(_countNonFixed);
    int256 totalDeposit = FixidityLib.multiply(ticketPrice, count);
    uint256 totalDepositNonFixed = uint256(FixidityLib.fromFixed(totalDeposit));
    require(token.transferFrom(msg.sender, address(this), totalDepositNonFixed), "token transfer failed");

    if (_hasEntry(msg.sender)) {
      entries[msg.sender].amount = FixidityLib.add(entries[msg.sender].amount, totalDeposit);
      entries[msg.sender].ticketCount = entries[msg.sender].ticketCount.add(uint256(_countNonFixed));
    } else {
      entries[msg.sender] = Entry(
        msg.sender,
        totalDeposit,
        uint256(_countNonFixed),
        0
      );
      entryCount = entryCount.add(1);
    }

    drawState.deposit(msg.sender, totalDepositNonFixed);

    totalAmount = FixidityLib.add(totalAmount, totalDeposit);

    // the total amount cannot exceed the max pool size
    require(totalAmount <= maxPoolSizeFixedPoint24(FixidityLib.maxFixedDiv()), "pool size exceeds maximum");

    emit BoughtTickets(msg.sender, _countNonFixed, totalDepositNonFixed);
  }

  /**
   * @notice Pools the deposits and supplies them to Compound.
   * Can only be called by the owner when the pool is open.
   * Fires the PoolLocked event.
   */
  function lock(bytes32 _secretHash) external requireOpen onlyOwner {
    if (allowLockAnytime) {
      lockStartBlock = block.number;
    } else {
      require(block.number >= lockStartBlock, "pool can only be locked on or after lock start block");
    }
    require(_secretHash != 0, "secret hash must be defined");
    secretHash = _secretHash;
    state = State.LOCKED;

    drawState.openNextDraw();

    if (totalAmount > 0) {
      uint256 totalAmountNonFixed = uint256(FixidityLib.fromFixed(totalAmount));
      require(token.approve(address(moneyMarket), totalAmountNonFixed), "could not approve money market spend");
      require(moneyMarket.mint(totalAmountNonFixed) == 0, "could not supply money market");
    }

    emit PoolLocked();
  }

  function unlock() public requireLocked {
    if (allowLockAnytime && msg.sender == owner()) {
      lockEndBlock = block.number;
    } else {
      require(lockEndBlock < block.number, "pool cannot be unlocked yet");
    }

    uint256 balance = moneyMarket.balanceOfUnderlying(address(this));

    if (balance > 0) {
      require(moneyMarket.redeemUnderlying(balance) == 0, "could not redeem from compound");
      finalAmount = FixidityLib.newFixed(int256(balance));
    }

    state = State.UNLOCKED;

    emit PoolUnlocked();
  }

  /**
   * @notice Withdraws the deposit from Compound and selects a winner.
   * Can only be called by the owner after the lock end block.
   * Fires the PoolUnlocked event.
   */
  function complete(bytes32 _secret) public onlyOwner {
    if (state == State.LOCKED) {
      unlock();
    }
    require(state == State.UNLOCKED, "state must be unlocked");
    require(keccak256(abi.encodePacked(_secret)) == secretHash, "secret does not match");
    secret = _secret;
    state = State.COMPLETE;
    winningAddress = calculateWinner();

    uint256 fee = feeAmount();
    if (fee > 0) {
      require(token.transfer(owner(), fee), "could not transfer winnings");
    }

    emit PoolComplete(winningAddress);
  }

  /**
   * @notice Transfers a users deposit, and potential winnings, back to them.
   * The Pool must be unlocked.
   * The user must have deposited funds.  Fires the Withdrawn event.
   */
  function withdraw() public {
    require(_hasEntry(msg.sender), "entrant exists");
    require(state == State.UNLOCKED || state == State.COMPLETE, "pool has not been unlocked");
    Entry storage entry = entries[msg.sender];
    int256 remainingBalanceNonFixed = balanceOf(msg.sender);
    require(remainingBalanceNonFixed > 0, "entrant has already withdrawn");
    entry.withdrawnNonFixed = entry.withdrawnNonFixed + remainingBalanceNonFixed;

    emit Withdrawn(msg.sender, remainingBalanceNonFixed);

    require(token.transfer(msg.sender, uint256(remainingBalanceNonFixed)), "could not transfer winnings");
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
    if (state == State.COMPLETE && _addr == winningAddress) {
      winningTotal = FixidityLib.add(winningTotal, netWinningsFixedPoint24());
    }
    return FixidityLib.fromFixed(winningTotal);
  }

  /**
   * @notice Calculates a user's remaining balance.  This is their winnings less how much they've withdrawn.
   * @return The users's current balance.
   */
  function balanceOf(address _addr) public view returns (int256) {
    Entry storage entry = entries[_addr];
    int256 winningTotalNonFixed = winnings(_addr);
    return winningTotalNonFixed - entry.withdrawnNonFixed;
  }

  function calculateWinner() private view returns (address) {
    if (totalAmount > 0) {
      return drawState.draw(randomToken());
    } else {
      return address(0);
    }
  }

  /**
   * @notice Selects and returns the winner's address
   * @return The winner's address
   */
  function winnerAddress() public view returns (address) {
    return winningAddress;
  }

  /**
   * @notice Returns the total interest on the pool less the fee as a whole number
   * @return The total interest on the pool less the fee as a whole number
   */
  function netWinnings() public view returns (int256) {
    return FixidityLib.fromFixed(netWinningsFixedPoint24());
  }

  /**
   * @notice Computes the total interest earned on the pool less the fee as a fixed point 24.
   * @return The total interest earned on the pool less the fee as a fixed point 24.
   */
  function netWinningsFixedPoint24() internal view returns (int256) {
    return grossWinningsFixedPoint24() - feeAmountFixedPoint24();
  }

  /**
   * @notice Computes the total interest earned on the pool as a fixed point 24.
   * This is what the winner will earn once the pool is unlocked.
   * @return The total interest earned on the pool as a fixed point 24.
   */
  function grossWinningsFixedPoint24() internal view returns (int256) {
    return FixidityLib.subtract(finalAmount, totalAmount);
  }

  /**
   * @notice Calculates the size of the fee based on the gross winnings
   * @return The fee for the pool to be transferred to the owner
   */
  function feeAmount() public view returns (uint256) {
    return uint256(FixidityLib.fromFixed(feeAmountFixedPoint24()));
  }

  /**
   * @notice Calculates the fee for the pool by multiplying the gross winnings by the fee fraction.
   * @return The fee for the pool as a fixed point 24
   */
  function feeAmountFixedPoint24() internal view returns (int256) {
    return FixidityLib.multiply(grossWinningsFixedPoint24(), feeFraction);
  }

  /**
   * @notice Selects a random number in the range from [0, total tokens deposited)
   * @return If the current block is before the end it returns 0, otherwise it returns the random number.
   */
  function randomToken() public view returns (uint256) {
    if (block.number <= lockEndBlock) {
      return 0;
    } else {
      return _selectRandom(uint256(FixidityLib.fromFixed(totalAmount)));
    }
  }

  /**
   * @notice Selects a random number in the range [0, total)
   * @param total The upper bound for the random number
   * @return The random number
   */
  function _selectRandom(uint256 total) internal view returns (uint256) {
    return UniformRandomNumber.uniform(_entropy(), total);
  }

  /**
   * @notice Computes the entropy used to generate the random number.
   * The blockhash of the lock end block is XOR'd with the secret revealed by the owner.
   * @return The computed entropy value
   */
  function _entropy() internal view returns (uint256) {
    return uint256(blockhash(block.number - 1) ^ secret);
  }

  /**
   * @notice Retrieves information about the pool.
   * @return A tuple containing:
   *    entryTotal (the total of all deposits)
   *    startBlock (the block after which the pool can be locked)
   *    endBlock (the block after which the pool can be unlocked)
   *    poolState (either OPEN, LOCKED, COMPLETE)
   *    winner (the address of the winner)
   *    supplyBalanceTotal (the total deposits plus any interest from Compound)
   *    ticketCost (the cost of each ticket in DAI)
   *    participantCount (the number of unique purchasers of tickets)
   *    maxPoolSize (the maximum theoretical size of the pool to prevent overflow)
   *    estimatedInterestFixedPoint18 (the estimated total interest percent for this pool)
   *    hashOfSecret (the hash of the secret the owner submitted upon locking)
   */
  function getInfo() public view returns (
    int256 entryTotal,
    uint256 startBlock,
    uint256 endBlock,
    State poolState,
    address winner,
    int256 supplyBalanceTotal,
    int256 ticketCost,
    uint256 participantCount,
    int256 maxPoolSize,
    int256 estimatedInterestFixedPoint18,
    bytes32 hashOfSecret
  ) {
    return (
      FixidityLib.fromFixed(totalAmount),
      lockStartBlock,
      lockEndBlock,
      state,
      winningAddress,
      FixidityLib.fromFixed(finalAmount),
      FixidityLib.fromFixed(ticketPrice),
      entryCount,
      FixidityLib.fromFixed(maxPoolSizeFixedPoint24(FixidityLib.maxFixedDiv())),
      FixidityLib.fromFixed(currentInterestFractionFixedPoint24(), uint8(18)),
      secretHash
    );
  }

  /**
   * @notice Retrieves information about a user's entry in the Pool.
   * @return Returns a tuple containing:
   *    addr (the address of the user)
   *    amount (the amount they deposited)
   *    ticketCount (the number of tickets they have bought)
   *    withdrawn (the amount they have withdrawn)
   */
  function getEntry(address _addr) public view returns (
    address addr,
    int256 amount,
    uint256 ticketCount,
    int256 withdrawn
  ) {
    Entry storage entry = entries[_addr];
    return (
      entry.addr,
      FixidityLib.fromFixed(entry.amount),
      entry.ticketCount,
      entry.withdrawnNonFixed
    );
  }

  /**
   * @notice Calculates the maximum pool size so that it doesn't overflow after earning interest
   * @dev poolSize = totalDeposits + totalDeposits * interest => totalDeposits = poolSize / (1 + interest)
   * @return The maximum size of the pool to be deposited into the money market
   */
  function maxPoolSizeFixedPoint24(int256 _maxValueFixedPoint24) public view returns (int256) {
    /// Double the interest rate in case it increases over the lock period.  Somewhat arbitrarily.
    int256 interestFraction = FixidityLib.multiply(currentInterestFractionFixedPoint24(), FixidityLib.newFixed(2));
    return FixidityLib.divide(_maxValueFixedPoint24, FixidityLib.add(interestFraction, FixidityLib.newFixed(1)));
  }

  /**
   * @notice Estimates the current effective interest rate using the money market's current supplyRateMantissa and the lock duration in blocks.
   * @return The current estimated effective interest rate
   */
  function currentInterestFractionFixedPoint24() public view returns (int256) {
    int256 blockDuration = int256(lockEndBlock - lockStartBlock);
    int256 supplyRateMantissaFixedPoint24 = FixidityLib.newFixed(int256(supplyRateMantissa()), uint8(18));
    return FixidityLib.multiply(supplyRateMantissaFixedPoint24, FixidityLib.newFixed(blockDuration));
  }

  /**
   * @notice Extracts the supplyRateMantissa value from the money market contract
   * @return The money market supply rate per block
   */
  function supplyRateMantissa() public view returns (uint256) {
    return moneyMarket.supplyRatePerBlock();
  }

  /**
   * @notice Determines whether a given address has bought tickets
   * @param _addr The given address
   * @return Returns true if the given address bought tickets, false otherwise.
   */
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
    require(state == State.COMPLETE, "pool is not complete");
    require(block.number > lockEndBlock, "block is before lock end period");
    _;
  }
}
