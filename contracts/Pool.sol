pragma solidity ^0.5.0;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Roles.sol";
import "./compound/ICErc20.sol";
import "./DrawManager.sol";
import "fixidity/contracts/FixidityLib.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "./IPool.sol";

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
contract Pool is IPool, Initializable, ReentrancyGuard {
  using DrawManager for DrawManager.DrawState;
  using SafeMath for uint256;
  using Roles for Roles.Role;

  uint256 constant UINT256_MAX = ~uint256(0);

  ICErc20 public cToken;
  address public nextFeeBeneficiary;
  uint256 public nextFeeFraction;
  uint256 public accountedBalance;
  mapping (address => uint256) balances;
  mapping (address => uint256) sponsorshipBalances;
  mapping(uint256 => Draw) draws;
  DrawManager.DrawState drawState;
  Roles.Role admins;

  /**
   * @notice Initializes a new Pool contract.
   * @param _owner The owner of the Pool.  They are able to change settings and are set as the owner of new lotteries.
   * @param _cToken The Compound Finance MoneyMarket contract to supply and withdraw tokens.
   * @param _nextFeeFraction The fraction of the gross winnings that should be transferred to the owner as the fee.  Is a fixed point 18 number.
   */
  function init (
    address _owner,
    address _cToken,
    uint256 _nextFeeFraction,
    address _beneficiary
  ) public initializer {
    require(_owner != address(0), "owner cannot be the null address");
    require(_cToken != address(0), "money market address is zero");
    cToken = ICErc20(_cToken);
    _addAdmin(_owner);
    _setNextFeeFraction(_nextFeeFraction);
    _setNextFeeBeneficiary(_beneficiary);
  }

  function open(bytes32 _secretHash) internal {
    drawState.openNextDraw();
    draws[drawState.openDrawIndex] = Draw(nextFeeFraction, nextFeeBeneficiary, block.number, _secretHash);
    emit Opened(
      drawState.openDrawIndex,
      nextFeeBeneficiary,
      _secretHash,
      nextFeeFraction
    );
  }

  function commit() internal {
    uint256 drawId = currentOpenDrawId();
    emit Committed(drawId);
  }

  /**
    OOP:

    1. Contract created
    2. commitFirstDrawAndOpenSecondDraw()
    ... time passes ...
    3. lockCommittedDrawRewards()
    4. rewardAndOpenNextDraw()
    ... time passes ...
    5. lockCommittedDrawReward()
    6. rewardAndOpenNextDraw()
   */

  function openNextDraw(bytes32 nextSecretHash) public onlyAdmin {
    require(currentCommittedDrawId() == 0, "there is a committed draw");
    if (currentOpenDrawId() != 0) {
      commit();
    }
    open(nextSecretHash);
  }

  function rewardAndOpenNextDraw(bytes32 nextSecretHash, bytes32 lastSecret) public onlyAdmin {
    require(currentCommittedDrawId() != 0, "a draw has not been committed");
    reward(lastSecret);
    commit();
    open(nextSecretHash);
  }

  /**
   * @notice Withdraws the deposit from Compound and selects a winner.
   * Can only be called by the owner after the lock end block.
   * Fires the PoolUnlocked event.
   */
  function reward(bytes32 _secret) internal {
    uint256 drawId = currentCommittedDrawId();
    Draw storage draw = draws[drawId];

    require(draw.secretHash == keccak256(abi.encodePacked(_secret)), "secret does not match");

    // Calculate the gross winnings
    uint256 underlyingBalance = balance();
    uint256 grossWinnings = underlyingBalance.sub(accountedBalance);

    // Updated the accounted total
    accountedBalance = underlyingBalance;

    // require the owner to have signed the commit block and gross winnings
    bytes32 entropy = _secret ^ keccak256(abi.encodePacked(draw.openedBlock, grossWinnings));

    // Select the winner using the hash as entropy
    address winningAddress = calculateWinner(entropy);

    uint256 fee = calculateFee(draw.feeFraction, grossWinnings);
    uint256 winnings = grossWinnings.sub(fee);

    // Update balance of the winner, and enter their winnings into the new draw
    balances[winningAddress] = balances[winningAddress].add(winnings);
    drawState.deposit(winningAddress, winnings);

    // Update balance of the beneficiary
    balances[draw.beneficiary] = balances[draw.beneficiary].add(fee);

    // Destroy the draw now that it's complete
    delete draws[drawId];

    emit Rewarded(
      drawId,
      winningAddress,
      entropy,
      winnings,
      fee
    );
  }

  function calculateFee(uint256 feeFraction, uint256 grossWinnings) internal pure returns (uint256) {
    int256 grossWinningsFixed = FixidityLib.newFixed(int256(grossWinnings));
    int256 feeFixed = FixidityLib.multiply(grossWinningsFixed, FixidityLib.newFixed(int256(feeFraction), uint8(18)));
    return uint256(FixidityLib.fromFixed(feeFixed));
  }

  function depositSponsorship(uint256 totalDepositNonFixed) public requireOpenDraw nonReentrant {
    sponsorshipBalances[msg.sender] = sponsorshipBalances[msg.sender].add(totalDepositNonFixed);

    // Deposit the funds
    _deposit(totalDepositNonFixed);

    emit SponsorshipDeposited(msg.sender, totalDepositNonFixed);
  }

  /**
   * @notice Deposits into the pool.  Deposits will become eligible in the next pool.
   */
  function depositPool(uint256 totalDepositNonFixed) public requireOpenDraw nonReentrant {
    // Update the user's balance
    balances[msg.sender] = balances[msg.sender].add(totalDepositNonFixed);

    // Update the user's eligibility
    drawState.deposit(msg.sender, totalDepositNonFixed);

    // Deposit the funds
    _deposit(totalDepositNonFixed);

    emit Deposited(msg.sender, totalDepositNonFixed);
  }

  function _deposit(uint256 totalDepositNonFixed) internal {
    require(totalDepositNonFixed > 0, "deposit is greater than zero");

    // Transfer the tokens into this contract
    require(token().transferFrom(msg.sender, address(this), totalDepositNonFixed), "token transfer failed");

    // Update the total of this contract
    accountedBalance = accountedBalance.add(totalDepositNonFixed);

    // Deposit into Compound
    ensureAllowance(totalDepositNonFixed);
    require(cToken.mint(totalDepositNonFixed) == 0, "could not supply money market");
  }

  function withdrawSponsorship(uint256 amount) public nonReentrant {
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
  function withdrawPool() public nonReentrant {
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
    accountedBalance = accountedBalance.sub(totalNonFixed);

    // Withdraw from Compound and transfer
    require(cToken.redeemUnderlying(totalNonFixed) == 0, "could not redeem from compound");
    require(token().transfer(msg.sender, totalNonFixed), "could not transfer winnings");

    emit Withdrawn(msg.sender, totalNonFixed);
  }

  function currentOpenDrawId() public view returns (uint256) {
    return drawState.openDrawIndex;
  }

  function currentCommittedDrawId() public view returns (uint256) {
    if (drawState.openDrawIndex > 1) {
      return drawState.openDrawIndex.sub(1);
    } else {
      return 0;
    }
  }

  function getDraw(uint256 drawId) public view returns (
    uint256 feeFraction,
    address beneficiary,
    uint256 openedBlock,
    bytes32 secretHash
  ) {
    Draw storage draw = draws[drawId];
    feeFraction = draw.feeFraction;
    beneficiary = draw.beneficiary;
    openedBlock = draw.openedBlock;
    secretHash = draw.secretHash;
  }

  /**
   * @notice Calculates a user's winnings.  This is their deposit plus their winnings, if any.
   * @param _addr The address of the user
   */
  function eligibleBalanceOf(address _addr) public view returns (uint256) {
    return drawState.balanceOf(_addr);
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

  function calculateWinner(bytes32 entropy) public view returns (address) {
    return drawState.drawWithEntropy(entropy);
  }

  function eligibleSupply() public view returns (uint256) {
    return drawState.eligibleSupply;
  }

  function eligibleSupplyFixed() internal view returns (int256) {
    return FixidityLib.newFixed(int256(drawState.eligibleSupply));
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
    return cToken.supplyRatePerBlock();
  }

  function ensureAllowance(uint256 amount) internal {
    if (token().allowance(address(this), address(cToken)) < amount) {
      require(token().approve(address(cToken), UINT256_MAX), "could not approve money market spend");
    }
  }

  /**
   * @notice Sets the fee fraction paid out to the Pool owner.
   * Fires the FeeFractionChanged event.
   * Can only be called by the owner. Only applies to subsequent Pools.
   * @param _nextFeeFraction The fraction to pay out.
   * Must be between 0 and 1 and formatted as a fixed point number with 18 decimals (as in Ether).
   */
  function setNextFeeFraction(uint256 _nextFeeFraction) public onlyAdmin {
    _setNextFeeFraction(_nextFeeFraction);
  }

  function _setNextFeeFraction(uint256 _nextFeeFraction) internal {
    require(_nextFeeFraction >= 0, "fee must be zero or greater");
    require(_nextFeeFraction <= 1000000000000000000, "fee fraction must be 1 or less");
    nextFeeFraction = _nextFeeFraction;

    emit FeeFractionChanged(_nextFeeFraction);
  }

  function setNextFeeBeneficiary(address _beneficiary) public onlyAdmin {
    _setNextFeeBeneficiary(_beneficiary);
  }

  function _setNextFeeBeneficiary(address _beneficiary) internal {
    require(_beneficiary != address(0), "beneficiary cannot be 0x");
    nextFeeBeneficiary = _beneficiary;
  }

  function addAdmin(address _admin) public onlyAdmin {
    _addAdmin(_admin);
  }

  function isAdmin(address _admin) public view returns (bool) {
    return admins.has(_admin);
  }

  function _addAdmin(address _admin) internal {
    admins.add(_admin);

    emit AdminAdded(_admin);
  }

  function removeAdmin(address _admin) public onlyAdmin {
    require(admins.has(_admin), "admin does not exist");
    admins.remove(_admin);

    emit AdminRemoved(_admin);
  }

  function token() internal view returns (IERC20) {
    return IERC20(cToken.underlying());
  }

  function balance() public returns (uint256) {
    return cToken.balanceOfUnderlying(address(this));
  }

  modifier onlyAdmin() {
    require(admins.has(msg.sender), "must be an admin");
    _;
  }

  modifier requireOpenDraw() {
    require(currentOpenDrawId() != 0, "there is no open draw");
    _;
  }
}
