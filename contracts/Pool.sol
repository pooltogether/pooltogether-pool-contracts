pragma solidity ^0.5.0;

import "openzeppelin-eth/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-eth/contracts/math/SafeMath.sol";
import "./compound/ICErc20.sol";
import "openzeppelin-eth/contracts/ownership/Ownable.sol";
import "./DrawManager.sol";
import "fixidity/contracts/FixidityLib.sol";
import "zos-lib/contracts/Initializable.sol";

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
   * @param amount The size of the deposit
   */
  event Deposited(address indexed sender, uint256 amount);

  /**
   * Emitted when a user withdraws from the pool.
   * @param sender The user that is withdrawing from the pool
   * @param amount The amount that the user withdrew
   */
  event Withdrawn(address indexed sender, uint256 amount);

  event PoolOpened(
    uint256 id,
    uint256 feeFraction
  );

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

  /**
   * Emitted when the fee fraction is changed
   * @param feeFractionFixedPoint18 The new fee fraction encoded as a fixed point 18 decimal
   */
  event FeeFractionChanged(int256 feeFractionFixedPoint18);

  enum State {
    OPEN,
    LOCKED,
    UNLOCKED,
    COMPLETE
  }

  mapping (address => uint256) balances;

  /**
   * The owner fee fraction to use for the next Pool
   */
  int256 private feeFractionFixedPoint18;

  int256 private totalAmount; // fixed point 24
  uint256 private drawCount;
  bytes32 private secretHash;
  bytes32 private secret;
  State public state;
  int256 private finalAmount; //fixed point 24
  ICErc20 public moneyMarket;
  IERC20 public token;
  int256 private feeFraction; //fixed point 24
  bool private ownerHasWithdrawn;
  address private winningAddress;

  DrawManager.DrawState drawState;

  /**
   * @notice Initializes a new Pool contract.
   * @param _admin The admin of the Pool.  They are able to change settings and are set as the owner of new lotteries.
   * @param _moneyMarket The Compound Finance MoneyMarket contract to supply and withdraw tokens.
   * @param _token The token to use for the Pools
   * @param _feeFractionFixedPoint18 The fraction of the gross winnings that should be transferred to the owner as the fee.  Is a fixed point 18 number.
   */
  function init (
    address _admin,
    address _moneyMarket,
    address _token,
    int256 _feeFractionFixedPoint18
  ) public initializer {
    require(_admin != address(0), "owner cannot be the null address");
    require(_moneyMarket != address(0), "money market address is zero");
    require(_token != address(0), "token address is zero");
    Ownable.initialize(_admin);
    token = IERC20(_token);
    moneyMarket = ICErc20(_moneyMarket);

    require(_token == moneyMarket.underlying(), "token does not match the underlying money market token");

    _setFeeFraction(_feeFractionFixedPoint18);

    open();
  }

  function open() internal {
    feeFraction = FixidityLib.newFixed(feeFractionFixedPoint18, uint8(18));
    drawCount = drawState.openNextDraw();
    state = State.OPEN;

    emit PoolOpened(
      drawCount,
      uint256(feeFractionFixedPoint18)
    );
  }

  /**
   * @notice Deposits into the pool.  Deposits will become eligible in the next pool.
   */
  function deposit (uint256 totalDepositNonFixed) public {
    require(totalDepositNonFixed > 0, "deposit is greater than zero");

    // Transfer the tokens into this contract
    require(token.transferFrom(msg.sender, address(this), totalDepositNonFixed), "token transfer failed");

    // Update the user's balance
    balances[msg.sender] = balances[msg.sender].add(totalDepositNonFixed);

    // Update the user's eligibility
    drawState.deposit(msg.sender, totalDepositNonFixed);

    // Update the total of this contract
    int256 totalDeposit = FixidityLib.newFixed(int256(totalDepositNonFixed));
    totalAmount = FixidityLib.add(totalAmount, totalDeposit);

    // Deposit into Compound
    require(token.approve(address(moneyMarket), totalDepositNonFixed), "could not approve money market spend");
    require(moneyMarket.mint(totalDepositNonFixed) == 0, "could not supply money market");

    emit Deposited(msg.sender, totalDepositNonFixed);
  }

  /**
   * @notice Pools the deposits and supplies them to Compound.
   * Can only be called by the owner when the pool is open.
   * Fires the PoolLocked event.
   */
  function lock(bytes32 _secretHash) external requireOpen onlyOwner {
    require(_secretHash != 0, "secret hash must be defined");
    open();
    secretHash = _secretHash;
    state = State.LOCKED;

    emit PoolLocked();
  }

  function unlock() public requireLocked {
    uint256 balance = moneyMarket.balanceOfUnderlying(address(this));
    if (balance > 0) {
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
    winningAddress = calculateWinner(entropy());
    balances[winningAddress] = balances[winningAddress].add(netWinnings());

    uint256 fee = feeAmount();
    address owner_ = owner();
    if (fee > 0) {
      balances[owner_] = balances[owner_].add(fee);
    }

    emit PoolComplete(winningAddress);
  }

  /**
   * @notice Transfers a users deposit, and potential winnings, back to them.
   * The Pool must be unlocked.
   * The user must have deposited funds.  Fires the Withdrawn event.
   */
  function withdraw() public {
    require(balances[msg.sender] > 0, "entrant has already withdrawn");

    // Update the user's balance
    uint balance = balances[msg.sender];
    balances[msg.sender] = 0;

    // Update their chances of winning
    uint256 drawBalance = drawState.balanceOf(msg.sender);
    drawState.withdraw(msg.sender, drawBalance);

    // Update the total of this contract
    totalAmount = FixidityLib.subtract(totalAmount, FixidityLib.newFixed(int256(balance)));

    // Withdraw from Compound and transfer
    require(moneyMarket.redeemUnderlying(balance) == 0, "could not redeem from compound");
    require(token.transfer(msg.sender, balance), "could not transfer winnings");

    emit Withdrawn(msg.sender, balance);
  }

  /**
   * @notice Calculates a user's winnings.  This is their deposit plus their winnings, if any.
   * @param _addr The address of the user
   */
  function winnings(address _addr) public view returns (uint256) {
    return balances[_addr];
  }

  /**
   * @notice Calculates a user's remaining balance.  This is their winnings less how much they've withdrawn.
   * @return The users's current balance.
   */
  function balanceOf(address _addr) public view returns (uint256) {
    return balances[_addr];
  }

  function calculateWinner(uint256 entropy) public view returns (address) {
    return drawState.drawWithEntropy(entropy);
  }

  function eligibleSupply() public view returns (uint256) {
    return drawState.eligibleSupply;
  }

  /**
   * @notice Computes the entropy used to generate the random number.
   * The blockhash of the lock end block is XOR'd with the secret revealed by the owner.
   * @return The computed entropy value
   */
  function entropy() public view returns (uint256) {
    return uint256(blockhash(block.number - 1) ^ secret);
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
  function netWinnings() public view returns (uint256) {
    return uint256(FixidityLib.fromFixed(netWinningsFixedPoint24()));
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
   * @notice Retrieves information about the pool.
   * @return A tuple containing:
   *    entryTotal (the total of all deposits)
   *    startBlock (the block after which the pool can be locked)
   *    endBlock (the block after which the pool can be unlocked)
   *    poolState (either OPEN, LOCKED, COMPLETE)
   *    winner (the address of the winner)
   *    supplyBalanceTotal (the total deposits plus any interest from Compound)
   *    participantCount (the number of unique purchasers of tickets)
   *    maxPoolSize (the maximum theoretical size of the pool to prevent overflow)
   *    estimatedInterestFixedPoint18 (the estimated total interest percent for this pool)
   *    hashOfSecret (the hash of the secret the owner submitted upon locking)
   */
  function getInfo() public view returns (
    int256 entryTotal,
    State poolState,
    address winner,
    int256 supplyBalanceTotal,
    bytes32 hashOfSecret
  ) {
    return (
      FixidityLib.fromFixed(totalAmount),
      state,
      winningAddress,
      FixidityLib.fromFixed(finalAmount),
      secretHash
    );
  }

  function maxPoolSize(int256 blocks) public view returns (int256) {
    return FixidityLib.fromFixed(maxPoolSizeFixedPoint24(blocks, FixidityLib.maxFixedDiv()));
  }

  /**
   * @notice Calculates the maximum pool size so that it doesn't overflow after earning interest
   * @dev poolSize = totalDeposits + totalDeposits * interest => totalDeposits = poolSize / (1 + interest)
   * @return The maximum size of the pool to be deposited into the money market
   */
  function maxPoolSizeFixedPoint24(int256 blocks, int256 _maxValueFixedPoint24) public view returns (int256) {
    /// Double the interest rate in case it increases over the lock period.  Somewhat arbitrarily.
    int256 interestFraction = FixidityLib.multiply(currentInterestFractionFixedPoint24(blocks), FixidityLib.newFixed(2));
    return FixidityLib.divide(_maxValueFixedPoint24, FixidityLib.add(interestFraction, FixidityLib.newFixed(1)));
  }

  function estimatedInterestRate(int256 blocks) public view returns (int256) {
    return FixidityLib.fromFixed(currentInterestFractionFixedPoint24(blocks), uint8(18));
  }

  /**
   * @notice Estimates the current effective interest rate using the money market's current supplyRateMantissa and the lock duration in blocks.
   * @return The current estimated effective interest rate
   */
  function currentInterestFractionFixedPoint24(int256 blockDuration) public view returns (int256) {
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
   * @notice Determines whether a given address has deposited
   * @param _addr The given address
   * @return Returns true if the given address deposited, false otherwise.
   */
  function _hasEntry(address _addr) internal view returns (bool) {
    return balances[_addr] > 0;
  }

  /**
   * @notice Sets the fee fraction paid out to the Pool owner.
   * Fires the FeeFractionChanged event.
   * Can only be called by the owner. Only applies to subsequent Pools.
   * @param _feeFractionFixedPoint18 The fraction to pay out.
   * Must be between 0 and 1 and formatted as a fixed point number with 18 decimals (as in Ether).
   */
  function setFeeFraction(int256 _feeFractionFixedPoint18) public onlyOwner {
    _setFeeFraction(_feeFractionFixedPoint18);
  }

  function _setFeeFraction(int256 _feeFractionFixedPoint18) internal {
    require(_feeFractionFixedPoint18 >= 0, "fee must be zero or greater");
    require(_feeFractionFixedPoint18 <= 1000000000000000000, "fee fraction must be 1 or less");
    feeFractionFixedPoint18 = _feeFractionFixedPoint18;

    emit FeeFractionChanged(_feeFractionFixedPoint18);
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
    _;
  }

  modifier requireCompleteOrNew() {
    require(state == State.OPEN || state == State.COMPLETE, "pool is not new or complete");
    _;
  }
}
