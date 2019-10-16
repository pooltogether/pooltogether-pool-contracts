/**
Copyright 2019 PoolTogether LLC

This file is part of PoolTogether.

PoolTogether is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation under version 3 of the License.

PoolTogether is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with PoolTogether.  If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity 0.5.10;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Roles.sol";
import "./compound/ICErc20.sol";
import "./DrawManager.sol";
import "fixidity/contracts/FixidityLib.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

/**
 * @title The Pool contract
 * @author Brendan Asselstine
 * @notice This contract allows users to pool deposits into Compound and win the accrued interest in periodic draws.
 * Funds are immediately deposited and withdrawn from the Compound cToken contract.
 * Draws go through three stages: open, committed and rewarded in that order.
 * Only one draw is ever in the open stage.  Users deposits are always added to the open draw.  Funds in the open Draw are that user's open balance.
 * When a Draw is committed, the funds in it are moved to a user's committed total and the total committed balance of all users is updated.
 * When a Draw is rewarded, the gross winnings are the accrued interest since the last reward (if any).  A winner is selected with their chances being
 * proportional to their committed balance vs the total committed balance of all users.
 *
 *
 * With the above in mind, there is always an open draw and possibly a committed draw.  The progression is:
 *
 * Step 1: Draw 1 Open
 * Step 2: Draw 2 Open | Draw 1 Committed
 * Step 3: Draw 3 Open | Draw 2 Committed | Draw 1 Rewarded
 * Step 4: Draw 4 Open | Draw 3 Committed | Draw 2 Rewarded
 * Step 5: Draw 5 Open | Draw 4 Committed | Draw 3 Rewarded
 * Step X: ...
 */
contract Pool is Initializable, ReentrancyGuard {
  using DrawManager for DrawManager.State;
  using SafeMath for uint256;
  using Roles for Roles.Role;

  uint256 private constant ETHER_IN_WEI = 1000000000000000000;

  /**
   * Emitted when a user deposits into the Pool.
   * @param sender The purchaser of the tickets
   * @param amount The size of the deposit
   */
  event Deposited(address indexed sender, uint256 amount);

  /**
   * Emitted when Sponsors have deposited into the Pool
   * @param sender The purchaser of the tickets
   * @param amount The size of the deposit
   */
  event SponsorshipDeposited(address indexed sender, uint256 amount);

  /**
   * Emitted when an admin has been added to the Pool.
   * @param admin The admin that was added
   */
  event AdminAdded(address indexed admin);

  /**
   * Emitted when an admin has been removed from the Pool.
   * @param admin The admin that was removed
   */
  event AdminRemoved(address indexed admin);

  /**
   * Emitted when a user withdraws from the pool.
   * @param sender The user that is withdrawing from the pool
   * @param amount The amount that the user withdrew
   */
  event Withdrawn(address indexed sender, uint256 amount);

  /**
   * Emitted when a new draw is opened for deposit.
   * @param drawId The draw id
   * @param feeBeneficiary The fee beneficiary for this draw
   * @param secretHash The committed secret hash
   * @param feeFraction The fee fraction of the winnings to be given to the beneficiary
   */
  event Opened(
    uint256 indexed drawId,
    address indexed feeBeneficiary,
    bytes32 secretHash,
    uint256 feeFraction
  );

  /**
   * Emitted when a draw is committed.
   * @param drawId The draw id
   */
  event Committed(
    uint256 indexed drawId
  );

  /**
   * Emitted when a draw is rewarded.
   * @param drawId The draw id
   * @param winner The address of the winner
   * @param entropy The entropy used to select the winner
   * @param winnings The net winnings given to the winner
   * @param fee The fee being given to the draw beneficiary
   */
  event Rewarded(
    uint256 indexed drawId,
    address indexed winner,
    bytes32 entropy,
    uint256 winnings,
    uint256 fee
  );

  /**
   * Emitted when the fee fraction is changed.  Takes effect on the next draw.
   * @param feeFraction The next fee fraction encoded as a fixed point 18 decimal
   */
  event NextFeeFractionChanged(uint256 feeFraction);

  /**
   * Emitted when the next fee beneficiary changes.  Takes effect on the next draw.
   * @param feeBeneficiary The next fee beneficiary
   */
  event NextFeeBeneficiaryChanged(address indexed feeBeneficiary);

  /**
   * Emitted when an admin pauses the contract
   */
  event Paused(address indexed sender);

  /**
   * Emitted when an admin unpauses the contract
   */
  event Unpaused(address indexed sender);

  struct Draw {
    uint256 feeFraction; //fixed point 18
    address feeBeneficiary;
    uint256 openedBlock;
    bytes32 secretHash;
  }

  /**
   * The Compound cToken that this Pool is bound to.
   */
  ICErc20 public cToken;

  /**
   * The fee beneficiary to use for subsequent Draws.
   */
  address public nextFeeBeneficiary;

  /**
   * The fee fraction to use for subsequent Draws.
   */
  uint256 public nextFeeFraction;

  /**
   * The total of all balances
   */
  uint256 public accountedBalance;

  /**
   * The total deposits and winnings for each user.
   */
  mapping (address => uint256) balances;

  /**
   * A mapping of draw ids to Draw structures
   */
  mapping(uint256 => Draw) draws;

  /**
   * A structure that is used to manage the user's odds of winning.
   */
  DrawManager.State drawState;

  /**
   * A structure containing the administrators
   */
  Roles.Role admins;

  /**
   * Whether the contract is paused
   */
  bool public paused;

  /**
   * @notice Initializes a new Pool contract.
   * @param _owner The owner of the Pool.  They are able to change settings and are set as the owner of new lotteries.
   * @param _cToken The Compound Finance MoneyMarket contract to supply and withdraw tokens.
   * @param _feeFraction The fraction of the gross winnings that should be transferred to the owner as the fee.  Is a fixed point 18 number.
   * @param _feeBeneficiary The address that will receive the fee fraction
   */
  function init (
    address _owner,
    address _cToken,
    uint256 _feeFraction,
    address _feeBeneficiary
  ) public initializer {
    require(_owner != address(0), "owner cannot be the null address");
    require(_cToken != address(0), "money market address is zero");
    cToken = ICErc20(_cToken);
    _addAdmin(_owner);
    _setNextFeeFraction(_feeFraction);
    _setNextFeeBeneficiary(_feeBeneficiary);
  }

  /**
   * @notice Opens a new Draw.
   * @param _secretHash The secret hash to commit to the Draw.
   */
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

  /**
   * @notice Commits the current draw.
   */
  function commit() internal {
    uint256 drawId = currentOpenDrawId();
    emit Committed(drawId);
  }

  /**
   * @notice Commits the current open draw, if any, and opens the next draw using the passed hash.  Really this function is only called twice:
   * the first after Pool contract creation and the second immediately after.
   * Can only be called by an admin.
   * May fire the Committed event, and always fires the Open event.
   * @param nextSecretHash The secret hash to use to open a new Draw
   */
  function openNextDraw(bytes32 nextSecretHash) public onlyAdmin unlessPaused {
    require(currentCommittedDrawId() == 0, "there is a committed draw");
    if (currentOpenDrawId() != 0) {
      commit();
    }
    open(nextSecretHash);
  }

  /**
   * @notice Rewards the current committed draw using the passed secret, commits the current open draw, and opens the next draw using the passed secret hash.
   * Can only be called by an admin.
   * Fires the Rewarded event, the Committed event, and the Open event.
   * @param nextSecretHash The secret hash to use to open a new Draw
   * @param lastSecret The secret to reveal to reward the current committed Draw.
   */
  function rewardAndOpenNextDraw(bytes32 nextSecretHash, bytes32 lastSecret, bytes32 _salt) public onlyAdmin unlessPaused {
    require(currentCommittedDrawId() != 0, "a draw has not been committed");
    reward(lastSecret, _salt);
    commit();
    open(nextSecretHash);
  }

  /**
   * @notice Rewards the winner for the current committed Draw using the passed secret.
   * The gross winnings are calculated by subtracting the accounted balance from the current underlying cToken balance.
   * A winner is calculated using the revealed secret and a hash of the Draw's opened block and the gross winnings.
   * If there is a winner (i.e. any eligible users) then winner's balance is updated with their net winnings.
   * The draw beneficiary's balance is updated with the fee.
   * The accounted balance is updated to include the fee and, if there was a winner, the net winnings.
   * Fires the Rewarded event.
   * @param _secret The secret to reveal for the current committed Draw
   */
  function reward(bytes32 _secret, bytes32 _salt) internal {
    uint256 drawId = currentCommittedDrawId();
    Draw storage draw = draws[drawId];

    require(draw.secretHash == keccak256(abi.encodePacked(_secret, _salt)), "secret does not match");

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
    balances[draw.feeBeneficiary] = balances[draw.feeBeneficiary].add(fee);

    // Calculate the net winnings
    uint256 netWinnings = grossWinnings.sub(fee);

    // If there is a winner who is to receive non-zero winnings
    if (winningAddress != address(0) && netWinnings != 0) {
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

  /**
   * @notice Calculate the beneficiary fee using the passed fee fraction and gross winnings.
   * @param _feeFraction The fee fraction, between 0 and 1, represented as a 18 point fixed number.
   * @param _grossWinnings The gross winnings to take a fraction of.
   */
  function calculateFee(uint256 _feeFraction, uint256 _grossWinnings) internal pure returns (uint256) {
    int256 grossWinningsFixed = FixidityLib.newFixed(int256(_grossWinnings));
    int256 feeFixed = FixidityLib.multiply(grossWinningsFixed, FixidityLib.newFixed(int256(_feeFraction), uint8(18)));
    return uint256(FixidityLib.fromFixed(feeFixed));
  }

  /**
   * @notice Allows a user to deposit a sponsorship amount.  The deposit is transferred into the cToken.
   * Sponsorships allow a user to contribute to the pool without becoming eligible to win.  They can withdraw their sponsorship at any time.
   * The deposit will immediately be added to Compound and the interest will contribute to the next draw.
   * @param _amount The amount of the token underlying the cToken to deposit.
   */
  function depositSponsorship(uint256 _amount) public unlessPaused nonReentrant {
    // Deposit the funds
    _deposit(_amount);

    emit SponsorshipDeposited(msg.sender, _amount);
  }

  /**
   * @notice Deposits into the pool under the current open Draw.  The deposit is transferred into the cToken.
   * Once the open draw is committed, the deposit will be added to the user's total committed balance and increase their chances of winning
   * proportional to the total committed balance of all users.
   * @param _amount The amount of the token underlying the cToken to deposit.
   */
  function depositPool(uint256 _amount) public requireOpenDraw unlessPaused nonReentrant {
    // Update the user's eligibility
    drawState.deposit(msg.sender, _amount);

    // Deposit the funds
    _deposit(_amount);

    emit Deposited(msg.sender, _amount);
  }

  /**
   * @notice Transfers tokens from the sender into the Compound cToken contract and updates the accountedBalance.
   * @param _amount The amount of the token underlying the cToken to deposit.
   */
  function _deposit(uint256 _amount) internal {
    require(_amount > 0, "deposit is not greater than zero");

    // Transfer the tokens into this contract
    require(token().transferFrom(msg.sender, address(this), _amount), "token transfer failed");

    // Update the user's balance
    balances[msg.sender] = balances[msg.sender].add(_amount);

    // Update the total of this contract
    accountedBalance = accountedBalance.add(_amount);

    // Deposit into Compound
    require(token().approve(address(cToken), _amount), "could not approve money market spend");
    require(cToken.mint(_amount) == 0, "could not supply money market");
  }

  /**
   * @notice Withdraw the sender's entire balance back to them.
   */
  function withdraw() public nonReentrant {
    uint balance = balances[msg.sender];

    require(balance > 0, "balance has already been withdrawn");

    // Update the user's balance
    balances[msg.sender] = 0;

    // Update their chances of winning
    drawState.withdraw(msg.sender);

    _withdraw(balance);
  }

  /**
   * @notice Transfers tokens from the cToken contract to the sender.  Updates the accounted balance.
   */
  function _withdraw(uint256 _amount) internal {
    require(_amount > 0, "withdrawal is not greater than zero");

    // Update the total of this contract
    accountedBalance = accountedBalance.sub(_amount);

    // Withdraw from Compound and transfer
    require(cToken.redeemUnderlying(_amount) == 0, "could not redeem from compound");
    require(token().transfer(msg.sender, _amount), "could not transfer winnings");

    emit Withdrawn(msg.sender, _amount);
  }

  /**
   * @notice Returns the id of the current open Draw.
   * @return The current open Draw id
   */
  function currentOpenDrawId() public view returns (uint256) {
    return drawState.openDrawIndex;
  }

  /**
   * @notice Returns the id of the current committed Draw.
   * @return The current committed Draw id
   */
  function currentCommittedDrawId() public view returns (uint256) {
    if (drawState.openDrawIndex > 1) {
      return drawState.openDrawIndex - 1;
    } else {
      return 0;
    }
  }

  /**
   * @notice Gets information for a given draw.
   * @param _drawId The id of the Draw to retrieve info for.
   * @return Fields including:
   *  feeFraction: the fee fraction
   *  feeBeneficiary: the beneficiary of the fee
   *  openedBlock: The block at which the draw was opened
   *  secretHash: The hash of the secret committed to this draw.
   */
  function getDraw(uint256 _drawId) public view returns (
    uint256 feeFraction,
    address feeBeneficiary,
    uint256 openedBlock,
    bytes32 secretHash
  ) {
    Draw storage draw = draws[_drawId];
    feeFraction = draw.feeFraction;
    feeBeneficiary = draw.feeBeneficiary;
    openedBlock = draw.openedBlock;
    secretHash = draw.secretHash;
  }

  /**
   * @notice Returns the total of the address's balance in committed Draws.  That is, the total that contributes to their chances of winning.
   * @param _addr The address of the user
   * @return The total committed balance for the user
   */
  function committedBalanceOf(address _addr) external view returns (uint256) {
    return drawState.committedBalanceOf(_addr);
  }

  /**
   * @notice Returns the total of the address's balance in the open Draw.  That is, the total that will *eventually* contribute to their chances of winning.
   * @param _addr The address of the user
   * @return The total open balance for the user
   */
  function openBalanceOf(address _addr) external view returns (uint256) {
    return drawState.openBalanceOf(_addr);
  }

  /**
   * @notice Returns a user's total balance, including both committed Draw balance and open Draw balance.
   * @param _addr The address of the user to check.
   * @return The users's current balance.
   */
  function totalBalanceOf(address _addr) external view returns (uint256) {
    return balances[_addr];
  }

  /**
   * @notice Returns a user's total balance, including both committed Draw balance and open Draw balance.
   * @param _addr The address of the user to check.
   * @return The users's current balance.
   */
  function balanceOf(address _addr) external view returns (uint256) {
    return drawState.committedBalanceOf(_addr);
  }

  /**
   * @notice Calculates a winner using the passed entropy for the current committed balances.
   * @param _entropy The entropy to use to select the winner
   * @return The winning address
   */
  function calculateWinner(bytes32 _entropy) public view returns (address) {
    return drawState.drawWithEntropy(_entropy);
  }

  /**
   * @notice Returns the total committed balance.  Used to compute an address's chances of winning.
   * @return The total committed balance.
   */
  function committedSupply() public view returns (uint256) {
    return drawState.committedSupply();
  }

  /**
   * @notice Returns the total open balance.  This balance is the number of tickets purchased for the open draw.
   * @return The total open balance
   */
  function openSupply() public view returns (uint256) {
    return drawState.openSupply();
  }

  /**
   * @notice Calculates the total estimated interest earned for the given number of blocks
   * @param _blocks The number of block that interest accrued for
   * @return The total estimated interest as a 18 point fixed decimal.
   */
  function estimatedInterestRate(uint256 _blocks) public view returns (uint256) {
    return supplyRatePerBlock().mul(_blocks);
  }

  /**
   * @notice Convenience function to return the supplyRatePerBlock value from the money market contract.
   * @return The cToken supply rate per block
   */
  function supplyRatePerBlock() public view returns (uint256) {
    return cToken.supplyRatePerBlock();
  }

  /**
   * @notice Sets the beneficiary fee fraction for subsequent Draws.
   * Fires the NextFeeFractionChanged event.
   * Can only be called by an admin.
   * @param _feeFraction The fee fraction to use.
   * Must be between 0 and 1 and formatted as a fixed point number with 18 decimals (as in Ether).
   */
  function setNextFeeFraction(uint256 _feeFraction) public onlyAdmin {
    _setNextFeeFraction(_feeFraction);
  }

  function _setNextFeeFraction(uint256 _feeFraction) internal {
    require(_feeFraction >= 0, "fee must be zero or greater");
    require(_feeFraction <= ETHER_IN_WEI, "fee fraction must be 1 or less");
    nextFeeFraction = _feeFraction;

    emit NextFeeFractionChanged(_feeFraction);
  }

  /**
   * @notice Sets the fee beneficiary for subsequent Draws.
   * Can only be called by admins.
   * @param _feeBeneficiary The beneficiary for the fee fraction.  Cannot be the 0 address.
   */
  function setNextFeeBeneficiary(address _feeBeneficiary) public onlyAdmin {
    _setNextFeeBeneficiary(_feeBeneficiary);
  }

  function _setNextFeeBeneficiary(address _feeBeneficiary) internal {
    require(_feeBeneficiary != address(0), "beneficiary should not be 0x0");
    nextFeeBeneficiary = _feeBeneficiary;

    emit NextFeeBeneficiaryChanged(_feeBeneficiary);
  }

  /**
   * @notice Adds an administrator.
   * Can only be called by administrators.
   * Fires the AdminAdded event.
   * @param _admin The address of the admin to add
   */
  function addAdmin(address _admin) public onlyAdmin {
    _addAdmin(_admin);
  }

  /**
   * @notice Checks whether a given address is an administrator.
   * @param _admin The address to check
   * @return True if the address is an admin, false otherwise.
   */
  function isAdmin(address _admin) public view returns (bool) {
    return admins.has(_admin);
  }

  function _addAdmin(address _admin) internal {
    admins.add(_admin);

    emit AdminAdded(_admin);
  }

  /**
   * @notice Removes an administrator
   * Can only be called by an admin.
   * @param _admin The address of the admin to remove
   */
  function removeAdmin(address _admin) public onlyAdmin {
    require(admins.has(_admin), "admin does not exist");
    admins.remove(_admin);

    emit AdminRemoved(_admin);
  }

  /**
   * @notice Returns the token underlying the cToken.
   * @return An ERC20 token address
   */
  function token() internal view returns (IERC20) {
    return IERC20(cToken.underlying());
  }

  /**
   * @notice Returns the underlying balance of this contract in the cToken.
   * @return The cToken underlying balance for this contract.
   */
  function balance() public returns (uint256) {
    return cToken.balanceOfUnderlying(address(this));
  }

  function pause() public unlessPaused onlyAdmin {
    paused = true;

    emit Paused(msg.sender);
  }

  function unpause() public whenPaused onlyAdmin {
    paused = false;

    emit Unpaused(msg.sender);
  }

  modifier onlyAdmin() {
    require(admins.has(msg.sender), "must be an admin");
    _;
  }

  modifier requireOpenDraw() {
    require(currentOpenDrawId() != 0, "there is no open draw");
    _;
  }

  modifier whenPaused() {
    require(paused, "contract is not paused");
    _;
  }

  modifier unlessPaused() {
    require(!paused, "contract is paused");
    _;
  }
}
