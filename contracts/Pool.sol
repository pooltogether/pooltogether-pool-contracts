pragma solidity 0.5.10;

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
 * @title The Pool contract
 * @author Brendan Asselstine
 * @notice This contract allows users to pool their Compound deposits and win the accrued interest in draws.
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

    // derive entropy from the revealed secret and the hash of the openedBlock and gross winnings
    bytes32 entropy = _secret ^ keccak256(abi.encodePacked(draw.openedBlock, grossWinnings));

    // Select the winner using the hash as entropy
    address winningAddress = calculateWinner(entropy);

    // Calculate the beneficiary fee
    uint256 fee = calculateFee(draw.feeFraction, grossWinnings);

    // Update balance of the beneficiary
    balances[draw.beneficiary] = balances[draw.beneficiary].add(fee);

    // Calculate the net winnings
    uint256 netWinnings = grossWinnings.sub(fee);

    // If there is a winner
    if (winningAddress != address(0)) {
      // Update balance of the winner
      balances[winningAddress] = balances[winningAddress].add(netWinnings);

      // Enter their winnings into the next draw
      drawState.deposit(winningAddress, netWinnings);

      // Updated the accounted total
      accountedBalance = underlyingBalance;
    } else {
      // Only account for the fee
      accountedBalance = accountedBalance.add(fee);
    }

    // Destroy the draw now that it's complete
    delete draws[drawId];

    emit Rewarded(
      drawId,
      winningAddress,
      entropy,
      netWinnings,
      fee
    );
  }

  function calculateFee(uint256 feeFraction, uint256 grossWinnings) internal pure returns (uint256) {
    int256 grossWinningsFixed = FixidityLib.newFixed(int256(grossWinnings));
    int256 feeFixed = FixidityLib.multiply(grossWinningsFixed, FixidityLib.newFixed(int256(feeFraction), uint8(18)));
    return uint256(FixidityLib.fromFixed(feeFixed));
  }

  function depositSponsorship(uint256 _amount) public requireOpenDraw nonReentrant {
    sponsorshipBalances[msg.sender] = sponsorshipBalances[msg.sender].add(_amount);

    // Deposit the funds
    _deposit(_amount);

    emit SponsorshipDeposited(msg.sender, _amount);
  }

  /**
   * @notice Deposits into the pool.  Deposits will become eligible in the next pool.
   */
  function depositPool(uint256 _amount) public requireOpenDraw nonReentrant {
    // Update the user's balance
    balances[msg.sender] = balances[msg.sender].add(_amount);

    // Update the user's eligibility
    drawState.deposit(msg.sender, _amount);

    // Deposit the funds
    _deposit(_amount);

    emit Deposited(msg.sender, _amount);
  }

  function _deposit(uint256 _amount) internal {
    require(_amount > 0, "deposit is greater than zero");

    // Transfer the tokens into this contract
    require(token().transferFrom(msg.sender, address(this), _amount), "token transfer failed");

    // Update the total of this contract
    accountedBalance = accountedBalance.add(_amount);

    // Deposit into Compound
    ensureAllowance(_amount);
    require(cToken.mint(_amount) == 0, "could not supply money market");
  }

  function withdrawSponsorship(uint256 _amount) public nonReentrant {
    require(sponsorshipBalances[msg.sender] >= _amount, "amount exceeds sponsorship balance");

    // Update the sponsorship balance
    sponsorshipBalances[msg.sender] = sponsorshipBalances[msg.sender].sub(_amount);

    _withdraw(_amount);
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

  function _withdraw(uint256 _amount) internal {
    require(_amount > 0, "withdrawal is greater than zero");

    // Update the total of this contract
    accountedBalance = accountedBalance.sub(_amount);

    // Withdraw from Compound and transfer
    require(cToken.redeemUnderlying(_amount) == 0, "could not redeem from compound");
    require(token().transfer(msg.sender, _amount), "could not transfer winnings");

    emit Withdrawn(msg.sender, _amount);
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
    return drawState.eligibleBalanceOf(_addr);
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

  function estimatedInterestRate(uint256 blocks) public view returns (uint256) {
    return supplyRatePerBlock().mul(blocks);
  }

  /**
   * @notice Extracts the supplyRatePerBlock value from the money market contract
   * @return The money market supply rate per block
   */
  function supplyRatePerBlock() public view returns (uint256) {
    return cToken.supplyRatePerBlock();
  }

  function ensureAllowance(uint256 amount) internal {
    if (token().allowance(address(this), address(cToken)) < amount) {
      require(token().approve(address(cToken), UINT256_MAX), "could not approve money market spend");
    }
  }

  /**
   * @notice Sets the fee fraction paid out to the Pool owner.
   * Fires the NextFeeFractionChanged event.
   * Can only be called by the owner. Only applies to subsequent Pools.
   * @param _nextFeeFraction The fraction to pay out.
   * Must be between 0 and 1 and formatted as a fixed point number with 18 decimals (as in Ether).
   */
  function setNextFeeFraction(uint256 _nextFeeFraction) public onlyAdmin {
    _setNextFeeFraction(_nextFeeFraction);
  }

  function _setNextFeeFraction(uint256 _feeFraction) internal {
    require(_feeFraction >= 0, "fee must be zero or greater");
    require(_feeFraction <= 1000000000000000000, "fee fraction must be 1 or less");
    nextFeeFraction = _feeFraction;

    emit NextFeeFractionChanged(_feeFraction);
  }

  function setNextFeeBeneficiary(address _beneficiary) public onlyAdmin {
    _setNextFeeBeneficiary(_beneficiary);
  }

  function _setNextFeeBeneficiary(address _beneficiary) internal {
    require(_beneficiary != address(0), "beneficiary cannot be 0x");
    nextFeeBeneficiary = _beneficiary;

    emit NextFeeBeneficiaryChanged(_beneficiary);
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
