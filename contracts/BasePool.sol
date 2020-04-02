/**
Copyright 2020 PoolTogether Inc.

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

pragma solidity 0.5.12;

import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Roles.sol";
import "./compound/ICErc20.sol";
import "./DrawManager.sol";
import "fixidity/contracts/FixidityLib.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "./Blocklock.sol";
import "./PoolToken.sol";

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
contract BasePool is Initializable, ReentrancyGuard {
  using DrawManager for DrawManager.State;
  using SafeMath for uint256;
  using Roles for Roles.Role;
  using Blocklock for Blocklock.State;

  bytes32 internal constant ROLLED_OVER_ENTROPY_MAGIC_NUMBER = bytes32(uint256(1));

  IERC1820Registry constant internal ERC1820_REGISTRY = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);

  // We inline the result of the following hashes because Solidity doesn't resolve them at compile time.
  // See https://github.com/ethereum/solidity/issues/4024.

  // keccak256("PoolTogetherRewardListener")
  bytes32 constant internal REWARD_LISTENER_INTERFACE_HASH =
      0x68f03b0b1a978ee238a70b362091d993343460bc1a2830ab3f708936d9f564a4;

  /**
   * Emitted when a user deposits into the Pool.
   * @param sender The purchaser of the tickets
   * @param amount The size of the deposit
   */
  event Deposited(address indexed sender, uint256 amount);

  /**
   * Emitted when a user deposits into the Pool and the deposit is immediately committed
   * @param sender The purchaser of the tickets
   * @param amount The size of the deposit
   */
  event DepositedAndCommitted(address indexed sender, uint256 amount);

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
   * Emitted when a user withdraws their sponsorship and fees from the pool.
   * @param sender The user that is withdrawing
   * @param amount The amount they are withdrawing
   */
  event SponsorshipAndFeesWithdrawn(address indexed sender, uint256 amount);

  /**
   * Emitted when a user withdraws from their open deposit.
   * @param sender The user that is withdrawing
   * @param amount The amount they are withdrawing
   */
  event OpenDepositWithdrawn(address indexed sender, uint256 amount);

  /**
   * Emitted when a user withdraws from their committed deposit.
   * @param sender The user that is withdrawing
   * @param amount The amount they are withdrawing
   */
  event CommittedDepositWithdrawn(address indexed sender, uint256 amount);

  /**
   * Emitted when an address collects a fee
   * @param sender The address collecting the fee
   * @param amount The fee amount
   * @param drawId The draw from which the fee was awarded
   */
  event FeeCollected(address indexed sender, uint256 amount, uint256 drawId);

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
   * Emitted when a RewardListener call fails
   * @param drawId The draw id
   * @param winner The address that one the draw
   * @param impl The implementation address of the RewardListener
   */
  event RewardListenerFailed(
    uint256 indexed drawId,
    address indexed winner,
    address indexed impl
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
  event DepositsPaused(address indexed sender);

  /**
   * Emitted when an admin unpauses the contract
   */
  event DepositsUnpaused(address indexed sender);

  /**
   * Emitted when the draw is rolled over in the event that the secret is forgotten.
   */
  event RolledOver(uint256 indexed drawId);

  struct Draw {
    uint256 feeFraction; //fixed point 18
    address feeBeneficiary;
    uint256 openedBlock;
    bytes32 secretHash;
    bytes32 entropy;
    address winner;
    uint256 netWinnings;
    uint256 fee;
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
  mapping (address => uint256) internal balances;

  /**
   * A mapping of draw ids to Draw structures
   */
  mapping(uint256 => Draw) internal draws;

  /**
   * A structure that is used to manage the user's odds of winning.
   */
  DrawManager.State internal drawState;

  /**
   * A structure containing the administrators
   */
  Roles.Role internal admins;

  /**
   * Whether the contract is paused
   */
  bool public paused;

  Blocklock.State internal blocklock;

  PoolToken public poolToken;

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
    address _feeBeneficiary,
    uint256 _lockDuration,
    uint256 _cooldownDuration
  ) public initializer {
    require(_owner != address(0), "Pool/owner-zero");
    require(_cToken != address(0), "Pool/ctoken-zero");
    cToken = ICErc20(_cToken);
    _addAdmin(_owner);
    _setNextFeeFraction(_feeFraction);
    _setNextFeeBeneficiary(_feeBeneficiary);
    initBlocklock(_lockDuration, _cooldownDuration);
  }

  function setPoolToken(PoolToken _poolToken) external onlyAdmin {
    require(address(poolToken) == address(0), "Pool/token-was-set");
    require(address(_poolToken.pool()) == address(this), "Pool/token-mismatch");
    poolToken = _poolToken;
  }

  function initBlocklock(uint256 _lockDuration, uint256 _cooldownDuration) internal {
    blocklock.setLockDuration(_lockDuration);
    blocklock.setCooldownDuration(_cooldownDuration);
  }

  /**
   * @notice Opens a new Draw.
   * @param _secretHash The secret hash to commit to the Draw.
   */
  function open(bytes32 _secretHash) internal {
    drawState.openNextDraw();
    draws[drawState.openDrawIndex] = Draw(
      nextFeeFraction,
      nextFeeBeneficiary,
      block.number,
      _secretHash,
      bytes32(0),
      address(0),
      uint256(0),
      uint256(0)
    );
    emit Opened(
      drawState.openDrawIndex,
      nextFeeBeneficiary,
      _secretHash,
      nextFeeFraction
    );
  }

  /**
   * @notice Emits the Committed event for the current open draw.
   */
  function emitCommitted() internal {
    uint256 drawId = currentOpenDrawId();
    emit Committed(drawId);
    if (address(poolToken) != address(0)) {
      poolToken.poolMint(openSupply());
    }
  }

  /**
   * @notice Commits the current open draw, if any, and opens the next draw using the passed hash.  Really this function is only called twice:
   * the first after Pool contract creation and the second immediately after.
   * Can only be called by an admin.
   * May fire the Committed event, and always fires the Open event.
   * @param nextSecretHash The secret hash to use to open a new Draw
   */
  function openNextDraw(bytes32 nextSecretHash) public onlyAdmin {
    if (currentCommittedDrawId() > 0) {
      require(currentCommittedDrawHasBeenRewarded(), "Pool/not-reward");
    }
    if (currentOpenDrawId() != 0) {
      emitCommitted();
    }
    open(nextSecretHash);
  }

  /**
   * @notice Ignores the current draw, and opens the next draw.
   * @dev This function will be removed once the winner selection has been decentralized.
   * @param nextSecretHash The hash to commit for the next draw
   */
  function rolloverAndOpenNextDraw(bytes32 nextSecretHash) public onlyAdmin {
    rollover();
    openNextDraw(nextSecretHash);
  }

  /**
   * @notice Rewards the current committed draw using the passed secret, commits the current open draw, and opens the next draw using the passed secret hash.
   * Can only be called by an admin.
   * Fires the Rewarded event, the Committed event, and the Open event.
   * @param nextSecretHash The secret hash to use to open a new Draw
   * @param lastSecret The secret to reveal to reward the current committed Draw.
   * @param _salt The salt that was used to conceal the secret
   */
  function rewardAndOpenNextDraw(bytes32 nextSecretHash, bytes32 lastSecret, bytes32 _salt) public onlyAdmin {
    reward(lastSecret, _salt);
    openNextDraw(nextSecretHash);
  }

  /**
   * @notice Rewards the winner for the current committed Draw using the passed secret.
   * The gross winnings are calculated by subtracting the accounted balance from the current underlying cToken balance.
   * A winner is calculated using the revealed secret.
   * If there is a winner (i.e. any eligible users) then winner's balance is updated with their net winnings.
   * The draw beneficiary's balance is updated with the fee.
   * The accounted balance is updated to include the fee and, if there was a winner, the net winnings.
   * Fires the Rewarded event.
   * @param _secret The secret to reveal for the current committed Draw
   * @param _salt The salt that was used to conceal the secret
   */
  function reward(bytes32 _secret, bytes32 _salt) public onlyAdmin onlyLocked requireCommittedNoReward nonReentrant {
    blocklock.unlock(block.number);
    // require that there is a committed draw
    // require that the committed draw has not been rewarded
    uint256 drawId = currentCommittedDrawId();

    Draw storage draw = draws[drawId];

    require(draw.secretHash == keccak256(abi.encodePacked(_secret, _salt)), "Pool/bad-secret");

    // derive entropy from the revealed secret
    bytes32 entropy = keccak256(abi.encodePacked(_secret));

    // Select the winner using the hash as entropy
    address winningAddress = calculateWinner(entropy);

    // Calculate the gross winnings
    uint256 underlyingBalance = balance();

    uint256 grossWinnings;

    // It's possible when the APR is zero that the underlying balance will be slightly lower than the accountedBalance
    // due to rounding errors in the Compound contract.
    if (underlyingBalance > accountedBalance) {
      grossWinnings = capWinnings(underlyingBalance.sub(accountedBalance));
    }

    // Calculate the beneficiary fee
    uint256 fee = calculateFee(draw.feeFraction, grossWinnings);

    // Update balance of the beneficiary
    balances[draw.feeBeneficiary] = balances[draw.feeBeneficiary].add(fee);

    // Calculate the net winnings
    uint256 netWinnings = grossWinnings.sub(fee);

    draw.winner = winningAddress;
    draw.netWinnings = netWinnings;
    draw.fee = fee;
    draw.entropy = entropy;

    // If there is a winner who is to receive non-zero winnings
    if (winningAddress != address(0) && netWinnings != 0) {
      // Updated the accounted total
      accountedBalance = underlyingBalance;

      // Update balance of the winner
      balances[winningAddress] = balances[winningAddress].add(netWinnings);

      // Enter their winnings into the open draw
      drawState.deposit(winningAddress, netWinnings);

      callRewarded(winningAddress, netWinnings, drawId);
    } else {
      // Only account for the fee
      accountedBalance = accountedBalance.add(fee);
    }

    emit Rewarded(
      drawId,
      winningAddress,
      entropy,
      netWinnings,
      fee
    );
    emit FeeCollected(draw.feeBeneficiary, fee, drawId);
  }

  /**
   * @notice Calls the reward listener for the winner, if a listener exists.
   * @dev Checks for a listener using the ERC1820 registry.  The listener is given a gas stipend of 200,000 to run the function.
   * The number 200,000 was selected because it's safely above the gas requirements for PoolTogether [Pod](https://github.com/pooltogether/pods) contract.
   *
   * @param winner The winner.  If they have a listener registered in the ERC1820 registry it will be called.
   * @param netWinnings The amount that was won.
   * @param drawId The draw id that was won.
   */
  function callRewarded(address winner, uint256 netWinnings, uint256 drawId) internal {
    address impl = ERC1820_REGISTRY.getInterfaceImplementer(winner, REWARD_LISTENER_INTERFACE_HASH);
    if (impl != address(0)) {
      (bool success,) = impl.call.gas(200000)(abi.encodeWithSignature("rewarded(address,uint256,uint256)", winner, netWinnings, drawId));
      if (!success) {
        emit RewardListenerFailed(drawId, winner, impl);
      }
    }
  }

  /**
   * @notice A function that skips the reward for the committed draw id.
   * @dev This function will be removed once the entropy is decentralized.
   */
  function rollover() public onlyAdmin requireCommittedNoReward {
    uint256 drawId = currentCommittedDrawId();

    Draw storage draw = draws[drawId];
    draw.entropy = ROLLED_OVER_ENTROPY_MAGIC_NUMBER;

    emit RolledOver(
      drawId
    );

    emit Rewarded(
      drawId,
      address(0),
      ROLLED_OVER_ENTROPY_MAGIC_NUMBER,
      0,
      0
    );
  }

  /**
   * @notice Ensures that the winnings don't overflow.  Note that we can make this integer max, because the fee
   * is always less than zero (meaning the FixidityLib.multiply will always make the number smaller)
   */
  function capWinnings(uint256 _grossWinnings) internal pure returns (uint256) {
    uint256 max = uint256(FixidityLib.maxNewFixed());
    if (_grossWinnings > max) {
      return max;
    }
    return _grossWinnings;
  }

  /**
   * @notice Calculate the beneficiary fee using the passed fee fraction and gross winnings.
   * @param _feeFraction The fee fraction, between 0 and 1, represented as a 18 point fixed number.
   * @param _grossWinnings The gross winnings to take a fraction of.
   */
  function calculateFee(uint256 _feeFraction, uint256 _grossWinnings) internal pure returns (uint256) {
    int256 grossWinningsFixed = FixidityLib.newFixed(int256(_grossWinnings));
    // _feeFraction *must* be less than 1 ether, so it will never overflow
    int256 feeFixed = FixidityLib.multiply(grossWinningsFixed, FixidityLib.newFixed(int256(_feeFraction), uint8(18)));
    return uint256(FixidityLib.fromFixed(feeFixed));
  }

  /**
   * @notice Allows a user to deposit a sponsorship amount.  The deposit is transferred into the cToken.
   * Sponsorships allow a user to contribute to the pool without becoming eligible to win.  They can withdraw their sponsorship at any time.
   * The deposit will immediately be added to Compound and the interest will contribute to the next draw.
   * @param _amount The amount of the token underlying the cToken to deposit.
   */
  function depositSponsorship(uint256 _amount) public unlessDepositsPaused nonReentrant {
    // Transfer the tokens into this contract
    require(token().transferFrom(msg.sender, address(this), _amount), "Pool/t-fail");

    // Deposit the sponsorship amount
    _depositSponsorshipFrom(msg.sender, _amount);
  }

  /**
   * @notice Deposits the token balance for this contract as a sponsorship.
   * If people erroneously transfer tokens to this contract, this function will allow us to recoup those tokens as sponsorship.
   */
  function transferBalanceToSponsorship() public unlessDepositsPaused {
    // Deposit the sponsorship amount
    _depositSponsorshipFrom(address(this), token().balanceOf(address(this)));
  }

  /**
   * @notice Deposits into the pool under the current open Draw.  The deposit is transferred into the cToken.
   * Once the open draw is committed, the deposit will be added to the user's total committed balance and increase their chances of winning
   * proportional to the total committed balance of all users.
   * @param _amount The amount of the token underlying the cToken to deposit.
   */
  function depositPool(uint256 _amount) public requireOpenDraw unlessDepositsPaused nonReentrant notLocked {
    // Transfer the tokens into this contract
    require(token().transferFrom(msg.sender, address(this), _amount), "Pool/t-fail");

    // Deposit the funds
    _depositPoolFrom(msg.sender, _amount);
  }

  /**
   * @notice Deposits sponsorship for a user
   * @param _spender The user who is sponsoring
   * @param _amount The amount they are sponsoring
   */
  function _depositSponsorshipFrom(address _spender, uint256 _amount) internal {
    // Deposit the funds
    _depositFrom(_spender, _amount);

    emit SponsorshipDeposited(_spender, _amount);
  }

  /**
   * @notice Deposits into the pool for a user.  The deposit will be open until the next draw is committed.
   * @param _spender The user who is depositing
   * @param _amount The amount the user is depositing
   */
  function _depositPoolFrom(address _spender, uint256 _amount) internal {
    // Update the user's eligibility
    drawState.deposit(_spender, _amount);

    _depositFrom(_spender, _amount);

    emit Deposited(_spender, _amount);
  }

  /**
   * @notice Deposits into the pool for a user.  The deposit is made part of the currently committed draw
   * @param _spender The user who is depositing
   * @param _amount The amount to deposit
   */
  function _depositPoolFromCommitted(address _spender, uint256 _amount) internal notLocked {
    // Update the user's eligibility
    drawState.depositCommitted(_spender, _amount);

    _depositFrom(_spender, _amount);

    emit DepositedAndCommitted(_spender, _amount);
  }

  /**
   * @notice Deposits into the pool for a user.  Updates their balance and transfers their tokens into this contract.
   * @param _spender The user who is depositing
   * @param _amount The amount they are depositing
   */
  function _depositFrom(address _spender, uint256 _amount) internal {
    // Update the user's balance
    balances[_spender] = balances[_spender].add(_amount);

    // Update the total of this contract
    accountedBalance = accountedBalance.add(_amount);

    // Deposit into Compound
    require(token().approve(address(cToken), _amount), "Pool/approve");
    require(cToken.mint(_amount) == 0, "Pool/supply");
  }

  /**
   * Withdraws the given amount from the user's deposits.  It first withdraws from their sponsorship,
   * then their open deposits, then their committed deposits.
   *
   * @param amount The amount to withdraw.
   */
  function withdraw(uint256 amount) public nonReentrant notLocked {
    uint256 remainingAmount = amount;
    // first sponsorship
    uint256 sponsorshipAndFeesBalance = sponsorshipAndFeeBalanceOf(msg.sender);
    if (sponsorshipAndFeesBalance < remainingAmount) {
      withdrawSponsorshipAndFee(sponsorshipAndFeesBalance);
      remainingAmount = remainingAmount.sub(sponsorshipAndFeesBalance);
    } else {
      withdrawSponsorshipAndFee(remainingAmount);
      return;
    }

    // now pending
    uint256 pendingBalance = drawState.openBalanceOf(msg.sender);
    if (pendingBalance < remainingAmount) {
      _withdrawOpenDeposit(msg.sender, pendingBalance);
      remainingAmount = remainingAmount.sub(pendingBalance);
    } else {
      _withdrawOpenDeposit(msg.sender, remainingAmount);
      return;
    }

    // now committed.  remainingAmount should not be greater than committed balance.
    _withdrawCommittedDeposit(msg.sender, remainingAmount);
  }

  /**
   * @notice Withdraw the sender's entire balance back to them.
   */
  function withdraw() public nonReentrant notLocked {
    uint256 committedBalance = drawState.committedBalanceOf(msg.sender);

    uint256 balance = balances[msg.sender];
    // Update their chances of winning
    drawState.withdraw(msg.sender);
    _withdraw(msg.sender, balance);

    if (address(poolToken) != address(0)) {
      poolToken.poolRedeem(msg.sender, committedBalance);
    }

    emit Withdrawn(msg.sender, balance);
  }

  /**
   * Withdraws only from the sender's sponsorship and fee balances
   * @param _amount The amount to withdraw
   */
  function withdrawSponsorshipAndFee(uint256 _amount) public {
    uint256 sponsorshipAndFees = sponsorshipAndFeeBalanceOf(msg.sender);
    require(_amount <= sponsorshipAndFees, "Pool/exceeds-sfee");
    _withdraw(msg.sender, _amount);

    emit SponsorshipAndFeesWithdrawn(msg.sender, _amount);
  }

  /**
   * Returns the total balance of the user's sponsorship and fees
   * @param _sender The user whose balance should be returned
   */
  function sponsorshipAndFeeBalanceOf(address _sender) public view returns (uint256) {
    return balances[_sender].sub(drawState.balanceOf(_sender));
  }

  /**
   * Withdraws from the user's open deposits
   * @param _amount The amount to withdraw
   */
  function withdrawOpenDeposit(uint256 _amount) public nonReentrant notLocked {
    _withdrawOpenDeposit(msg.sender, _amount);
  }

  function _withdrawOpenDeposit(address sender, uint256 _amount) internal {
    drawState.withdrawOpen(sender, _amount);
    _withdraw(sender, _amount);

    emit OpenDepositWithdrawn(sender, _amount);
  }

  /**
   * Withdraws from the user's committed deposits
   * @param _amount The amount to withdraw
   */
  function withdrawCommittedDeposit(uint256 _amount) public nonReentrant notLocked returns (bool)  {
    _withdrawCommittedDeposit(msg.sender, _amount);
    return true;
  }

  function _withdrawCommittedDeposit(address sender, uint256 _amount) internal {
    _withdrawCommittedDepositAndEmit(sender, _amount);
    if (address(poolToken) != address(0)) {
      poolToken.poolRedeem(sender, _amount);
    }
  }

  /**
   * Allows the associated PoolToken to withdraw for a user; useful when redeeming through the token.
   * @param _from The user to withdraw from
   * @param _amount The amount to withdraw
   */
  function withdrawCommittedDepositFrom(
    address _from,
    uint256 _amount
  ) external onlyToken notLocked returns (bool)  {
    return _withdrawCommittedDepositAndEmit(_from, _amount);
  }

  /**
   * A function that withdraws committed deposits for a user and emits the corresponding events.
   * @param _from User to withdraw for
   * @param _amount The amount to withdraw
   */
  function _withdrawCommittedDepositAndEmit(address _from, uint256 _amount) internal returns (bool) {
    drawState.withdrawCommitted(_from, _amount);
    _withdraw(_from, _amount);

    emit CommittedDepositWithdrawn(_from, _amount);

    return true;
  }

  /**
   * @notice Allows the associated PoolToken to move committed tokens from one user to another.
   * @param _from The account to move tokens from
   * @param _to The account that is receiving the tokens
   * @param _amount The amount of tokens to transfer
   */
  function moveCommitted(
    address _from,
    address _to,
    uint256 _amount
  ) external onlyToken onlyCommittedBalanceGteq(_from, _amount) notLocked returns (bool) {
    balances[_from] = balances[_from].sub(_amount, "move could not sub amount");
    balances[_to] = balances[_to].add(_amount);
    drawState.withdrawCommitted(_from, _amount);
    drawState.depositCommitted(_to, _amount);

    return true;
  }

  /**
   * @notice Transfers tokens from the cToken contract to the sender.  Updates the accounted balance.
   */
  function _withdraw(address _sender, uint256 _amount) internal {
    uint256 balance = balances[_sender];

    require(_amount <= balance, "Pool/no-funds");

    // Update the user's balance
    balances[_sender] = balance.sub(_amount);

    // Update the total of this contract
    accountedBalance = accountedBalance.sub(_amount);

    // Withdraw from Compound and transfer
    require(cToken.redeemUnderlying(_amount) == 0, "Pool/redeem");
    require(token().transfer(_sender, _amount), "Pool/transfer");
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
   * @notice Returns whether the current committed draw has been rewarded
   * @return True if the current committed draw has been rewarded, false otherwise
   */
  function currentCommittedDrawHasBeenRewarded() internal view returns (bool) {
    Draw storage draw = draws[currentCommittedDrawId()];
    return draw.entropy != bytes32(0);
  }

  /**
   * @notice Gets information for a given draw.
   * @param _drawId The id of the Draw to retrieve info for.
   * @return Fields including:
   *  feeFraction: the fee fraction
   *  feeBeneficiary: the beneficiary of the fee
   *  openedBlock: The block at which the draw was opened
   *  secretHash: The hash of the secret committed to this draw.
   *  entropy: the entropy used to select the winner
   *  winner: the address of the winner
   *  netWinnings: the total winnings less the fee
   *  fee: the fee taken by the beneficiary
   */
  function getDraw(uint256 _drawId) public view returns (
    uint256 feeFraction,
    address feeBeneficiary,
    uint256 openedBlock,
    bytes32 secretHash,
    bytes32 entropy,
    address winner,
    uint256 netWinnings,
    uint256 fee
  ) {
    Draw storage draw = draws[_drawId];
    feeFraction = draw.feeFraction;
    feeBeneficiary = draw.feeBeneficiary;
    openedBlock = draw.openedBlock;
    secretHash = draw.secretHash;
    entropy = draw.entropy;
    winner = draw.winner;
    netWinnings = draw.netWinnings;
    fee = draw.fee;
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
   * @notice Returns a user's total balance.  This includes their sponsorships, fees, open deposits, and committed deposits.
   * @param _addr The address of the user to check.
   * @return The user's current balance.
   */
  function totalBalanceOf(address _addr) external view returns (uint256) {
    return balances[_addr];
  }

  /**
   * @notice Returns a user's committed balance.  This is the balance of their Pool tokens.
   * @param _addr The address of the user to check.
   * @return The user's current balance.
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
    require(_feeFraction <= 1 ether, "Pool/less-1");
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

  /**
   * @notice Sets the fee beneficiary for subsequent Draws.
   * @param _feeBeneficiary The beneficiary for the fee fraction.  Cannot be the 0 address.
   */
  function _setNextFeeBeneficiary(address _feeBeneficiary) internal {
    require(_feeBeneficiary != address(0), "Pool/not-zero");
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

  /**
   * @notice Checks whether a given address is an administrator.
   * @param _admin The address to check
   * @return True if the address is an admin, false otherwise.
   */
  function _addAdmin(address _admin) internal {
    admins.add(_admin);

    emit AdminAdded(_admin);
  }

  /**
   * @notice Removes an administrator
   * Can only be called by an admin.
   * Admins cannot remove themselves.  This ensures there is always one admin.
   * @param _admin The address of the admin to remove
   */
  function removeAdmin(address _admin) public onlyAdmin {
    require(admins.has(_admin), "Pool/no-admin");
    require(_admin != msg.sender, "Pool/remove-self");
    admins.remove(_admin);

    emit AdminRemoved(_admin);
  }

  /**
   * Requires that there is a committed draw that has not been rewarded.
   */
  modifier requireCommittedNoReward() {
    require(currentCommittedDrawId() > 0, "Pool/committed");
    require(!currentCommittedDrawHasBeenRewarded(), "Pool/already");
    _;
  }

  /**
   * @notice Returns the token underlying the cToken.
   * @return An ERC20 token address
   */
  function token() public view returns (IERC20) {
    return IERC20(cToken.underlying());
  }

  /**
   * @notice Returns the underlying balance of this contract in the cToken.
   * @return The cToken underlying balance for this contract.
   */
  function balance() public returns (uint256) {
    return cToken.balanceOfUnderlying(address(this));
  }

  /**
   * @notice Locks the movement of tokens (essentially the committed deposits and winnings)
   * @dev The lock only lasts for a duration of blocks.  The lock cannot be relocked until the cooldown duration completes.
   */
  function lockTokens() public onlyAdmin {
    blocklock.lock(block.number);
  }

  /**
   * @notice Unlocks the movement of tokens (essentially the committed deposits)
   */
  function unlockTokens() public onlyAdmin {
    blocklock.unlock(block.number);
  }

  /**
   * Pauses all deposits into the contract.  This was added so that we can slowly deprecate Pools.  Users can continue
   * to collect rewards and withdraw, but eventually the Pool will grow smaller.
   *
   * emits DepositsPaused
   */
  function pauseDeposits() public unlessDepositsPaused onlyAdmin {
    paused = true;

    emit DepositsPaused(msg.sender);
  }

  /**
   * @notice Unpauses all deposits into the contract
   *
   * emits DepositsUnpaused
   */
  function unpauseDeposits() public whenDepositsPaused onlyAdmin {
    paused = false;

    emit DepositsUnpaused(msg.sender);
  }

  /**
   * @notice Check if the contract is locked.
   * @return True if the contract is locked, false otherwise
   */
  function isLocked() public view returns (bool) {
    return blocklock.isLocked(block.number);
  }

  /**
   * @notice Returns the block number at which the lock expires
   * @return The block number at which the lock expires
   */
  function lockEndAt() public view returns (uint256) {
    return blocklock.lockEndAt();
  }

  /**
   * @notice Check cooldown end block
   * @return The block number at which the cooldown ends and the contract can be re-locked
   */
  function cooldownEndAt() public view returns (uint256) {
    return blocklock.cooldownEndAt();
  }

  /**
   * @notice Returns whether the contract can be locked
   * @return True if the contract can be locked, false otherwise
   */
  function canLock() public view returns (bool) {
    return blocklock.canLock(block.number);
  }

  /**
   * @notice Duration of the lock
   * @return Returns the duration of the lock in blocks.
   */
  function lockDuration() public view returns (uint256) {
    return blocklock.lockDuration;
  }

  /**
   * @notice Returns the cooldown duration.  The cooldown period starts after the Pool has been unlocked.
   * The Pool cannot be locked during the cooldown period.
   * @return The cooldown duration in blocks
   */
  function cooldownDuration() public view returns (uint256) {
    return blocklock.cooldownDuration;
  }

  /**
   * @notice requires the pool not to be locked
   */
  modifier notLocked() {
    require(!blocklock.isLocked(block.number), "Pool/locked");
    _;
  }

  /**
   * @notice requires the pool to be locked
   */
  modifier onlyLocked() {
    require(blocklock.isLocked(block.number), "Pool/unlocked");
    _;
  }

  /**
   * @notice requires the caller to be an admin
   */
  modifier onlyAdmin() {
    require(admins.has(msg.sender), "Pool/admin");
    _;
  }

  /**
   * @notice Requires an open draw to exist
   */
  modifier requireOpenDraw() {
    require(currentOpenDrawId() != 0, "Pool/no-open");
    _;
  }

  /**
   * @notice Requires deposits to be paused
   */
  modifier whenDepositsPaused() {
    require(paused, "Pool/d-not-paused");
    _;
  }

  /**
   * @notice Requires deposits not to be paused
   */
  modifier unlessDepositsPaused() {
    require(!paused, "Pool/d-paused");
    _;
  }

  /**
   * @notice Requires the caller to be the pool token
   */
  modifier onlyToken() {
    require(msg.sender == address(poolToken), "Pool/only-token");
    _;
  }

  /**
   * @notice requires the passed user's committed balance to be greater than or equal to the passed amount
   * @param _from The user whose committed balance should be checked
   * @param _amount The minimum amount they must have
   */
  modifier onlyCommittedBalanceGteq(address _from, uint256 _amount) {
    uint256 committedBalance = drawState.committedBalanceOf(_from);
    require(_amount <= committedBalance, "not enough funds");
    _;
  }
}
