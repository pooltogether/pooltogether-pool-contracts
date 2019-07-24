pragma solidity ^0.5.0;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./compound/ICErc20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "./DrawManager.sol";
import "fixidity/contracts/FixidityLib.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "./IPool.sol";

/**

  What should be swappable: 

  1. Winner selection
  2. Fund dispersion?  Fee fraction should possibly be optional

 */


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
contract Pool is IPool, Ownable {
  using DrawManager for DrawManager.DrawState;
  using SafeMath for uint256;

  uint256 constant UINT256_MAX = ~uint256(0);

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

  /**
   * Emitted when the pool is locked.
   */
  event Opened(
    uint256 indexed drawId,
    uint256 startingTotal,
    uint256 feeFraction
  );

  event Committed(
    uint256 indexed drawId,
    bytes32 secretHash
  );

  /**
   * Emitted when the pool rewards a winner
   */
  event Rewarded(
    uint256 indexed drawId,
    address indexed winner,
    bytes32 secret,
    uint256 winnings,
    uint256 fee
  );

  /**
   * Emitted when the fee fraction is changed
   * @param feeFractionFixedPoint18 The new fee fraction encoded as a fixed point 18 decimal
   */
  event FeeFractionChanged(uint256 feeFractionFixedPoint18);

  struct Draw {
    int256 startingTotal; //fixed point 24
    int256 feeFraction; //fixed point 24
  }

  /**
   * The owner fee fraction to use for the next Pool
   */
  uint256 private feeFractionFixedPoint18;
  ICErc20 public moneyMarket;
  IERC20 public token;
  mapping (address => uint256) balances;
  mapping (address => uint256) sponsorshipBalances;
  int256 private totalAmount; // fixed point 24
  mapping(uint256 => Draw) draws;
  bytes32 private secretHash;

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
    uint256 _feeFractionFixedPoint18
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
    drawState.openNextDraw();

    int256 feeFraction = FixidityLib.newFixed(int256(feeFractionFixedPoint18), uint8(18));

    draws[drawState.openDrawIndex] = Draw(0, feeFraction);

    emit Opened(
      drawState.openDrawIndex,
      uint256(FixidityLib.fromFixed(totalAmount)),
      feeFractionFixedPoint18
    );
  }

  /**
   * @notice Pools the deposits and supplies them to Compound.
   * Can only be called by the owner when the pool is open.
   * Fires the PoolLocked event.
   */
  function commit(bytes32 _secretHash) public onlyOwner {
    require(secretHash == 0, "secret was already committed");
    require(_secretHash != 0, "passed secret hash must be defined");
    secretHash = _secretHash;
    emit Committed(
      drawState.openDrawIndex,
      _secretHash
    );
    draws[drawState.openDrawIndex].startingTotal = totalAmount;
    open();
  }

  function depositSponsorship(uint256 totalDepositNonFixed) public {
    sponsorshipBalances[msg.sender] = sponsorshipBalances[msg.sender].add(totalDepositNonFixed);

    // Deposit the funds
    _deposit(totalDepositNonFixed);
  }

  /**
   * @notice Deposits into the pool.  Deposits will become eligible in the next pool.
   */
  function depositPool(uint256 totalDepositNonFixed) public {
    // Update the user's balance
    balances[msg.sender] = balances[msg.sender].add(totalDepositNonFixed);

    // Update the user's eligibility
    drawState.deposit(msg.sender, totalDepositNonFixed);

    // Deposit the funds
    _deposit(totalDepositNonFixed);
  }

  function _deposit(uint256 totalDepositNonFixed) internal {
    require(totalDepositNonFixed > 0, "deposit is greater than zero");

    // Transfer the tokens into this contract
    require(token.transferFrom(msg.sender, address(this), totalDepositNonFixed), "token transfer failed");

    // Update the total of this contract
    int256 totalDeposit = FixidityLib.newFixed(int256(totalDepositNonFixed));
    totalAmount = FixidityLib.add(totalAmount, totalDeposit);

    // Deposit into Compound
    ensureAllowance(totalDepositNonFixed);
    require(moneyMarket.mint(totalDepositNonFixed) == 0, "could not supply money market");

    emit Deposited(msg.sender, totalDepositNonFixed);
  }

  /**
   * @notice Withdraws the deposit from Compound and selects a winner.
   * Can only be called by the owner after the lock end block.
   * Fires the PoolUnlocked event.
   */
  function reward(bytes32 secret) internal {
    require(keccak256(abi.encodePacked(secret)) == secretHash, "secret does not match");
    secretHash = 0;

    uint256 drawId = drawState.openDrawIndex.sub(1);
    Draw storage draw = draws[drawId];

    uint256 balance = moneyMarket.balanceOfUnderlying(address(this));
    int256 balanceFixed = FixidityLib.newFixed(int256(balance));
    int256 grossWinningsFixed = FixidityLib.subtract(balanceFixed, draw.startingTotal);
    int256 feeFixed = FixidityLib.multiply(grossWinningsFixed, draw.feeFraction);
    uint256 fee = uint256(FixidityLib.fromFixed(feeFixed));
    int256 winningsFixed = FixidityLib.subtract(grossWinningsFixed, feeFixed);
    uint256 winnings = uint256(FixidityLib.fromFixed(winningsFixed));

    address winningAddress = calculateWinner(entropy(secret));
    balances[winningAddress] = balances[winningAddress].add(winnings);

    address owner_ = owner();
    if (fee > 0) {
      balances[owner_] = balances[owner_].add(fee);
    }

    delete draws[drawId];

    emit Rewarded(
      drawState.openDrawIndex.sub(1),
      winningAddress,
      secret,
      winnings,
      fee
    );
  }

  function rewardAndCommit(bytes32 _secret, bytes32 _newSecretHash) public onlyOwner {
    reward(_secret);
    commit(_newSecretHash);
  }

  function withdrawSponsorship(uint256 amount) public {
    require(sponsorshipBalances[msg.sender] >= amount, "amount exceeds sponsorship balance");

    // Update the sponsorship balance
    sponsorshipBalances[msg.sender] = sponsorshipBalances[msg.sender].sub(amount);

    _withdraw(amount);
  }

  /**
   * @notice Transfers a users deposit, and potential winnings, back to them.
   * The Pool must be unlocked.
   * The user must have deposited funds.  Fires the Withdrawn event.
   */
  function withdrawPool() public {
    require(balances[msg.sender] > 0, "entrant has already withdrawn");

    // Update the user's balance
    uint balance = balances[msg.sender];
    balances[msg.sender] = 0;

    // Update their chances of winning
    uint256 drawBalance = drawState.balanceOf(msg.sender);
    drawState.withdraw(msg.sender, drawBalance);

    _withdraw(balance);
  }

  function _withdraw(uint256 totalNonFixed) internal {
    require(totalNonFixed > 0, "withdrawal is greater than zero");

    // Update the total of this contract
    totalAmount = FixidityLib.subtract(totalAmount, FixidityLib.newFixed(int256(totalNonFixed)));

    // Withdraw from Compound and transfer
    require(moneyMarket.redeemUnderlying(totalNonFixed) == 0, "could not redeem from compound");
    require(token.transfer(msg.sender, totalNonFixed), "could not transfer winnings");

    emit Withdrawn(msg.sender, totalNonFixed);
  }

  /**
   * @notice Calculates a user's winnings.  This is their deposit plus their winnings, if any.
   * @param _addr The address of the user
   */
  function winnings(address _addr) public view returns (uint256) {
    return balances[_addr] - drawState.balanceOf(_addr);
  }

  /**
   * @notice Calculates a user's total balance.
   * @return The users's current balance.
   */
  function balanceOf(address _addr) public view returns (uint256) {
    return balances[_addr];
  }

  /**
   * @notice Calculates a user's total balance.
   * @return The users's current balance.
   */
  function balanceOfSponsorship(address _addr) public view returns (uint256) {
    return sponsorshipBalances[_addr];
  }

  function calculateWinner(uint256 entropy) public view returns (address) {
    return drawState.drawWithEntropy(entropy);
  }

  function eligibleSupply() public view returns (uint256) {
    return drawState.eligibleSupply;
  }

  function eligibleSupplyFixed() internal view returns (int256) {
    return FixidityLib.newFixed(int256(drawState.eligibleSupply));
  }

  /**
   * @notice Computes the entropy used to generate the random number.
   * The blockhash of the lock end block is XOR'd with the secret revealed by the owner.
   * @return The computed entropy value
   */
  function entropy(bytes32 secret) public view returns (uint256) {
    return uint256(blockhash(block.number - 1) ^ secret);
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
   * @notice Sets the fee fraction paid out to the Pool owner.
   * Fires the FeeFractionChanged event.
   * Can only be called by the owner. Only applies to subsequent Pools.
   * @param _feeFractionFixedPoint18 The fraction to pay out.
   * Must be between 0 and 1 and formatted as a fixed point number with 18 decimals (as in Ether).
   */
  function setFeeFraction(uint256 _feeFractionFixedPoint18) public onlyOwner {
    _setFeeFraction(_feeFractionFixedPoint18);
  }

  function ensureAllowance(uint256 amount) internal {
    if (token.allowance(address(this), address(moneyMarket)) < amount) {
      require(token.approve(address(moneyMarket), UINT256_MAX), "could not approve money market spend");
    }
  }

  function _setFeeFraction(uint256 _feeFractionFixedPoint18) internal {
    require(_feeFractionFixedPoint18 >= 0, "fee must be zero or greater");
    require(_feeFractionFixedPoint18 <= 1000000000000000000, "fee fraction must be 1 or less");
    feeFractionFixedPoint18 = _feeFractionFixedPoint18;

    emit FeeFractionChanged(_feeFractionFixedPoint18);
  }

  modifier requireCommitted() {
    require(secretHash != 0, "no secret has been committed");
    _;
  }
}
