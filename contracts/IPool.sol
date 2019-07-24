pragma solidity ^0.5.0;

interface IPool {

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
  ) external;

  /**
   * @notice Pools the deposits and supplies them to Compound.
   * Can only be called by the owner when the pool is open.
   * Fires the PoolLocked event.
   */
  function commit(bytes32 _secretHash) external;

  /**
   * @notice Deposits into the pool.  Deposits will become eligible in the next pool.
   */
  function depositPool(uint256 totalDepositNonFixed) external;

  function rewardAndCommit(bytes32 _secret, bytes32 _newSecretHash) external;

  /**
   * @notice Transfers a users deposit, and potential winnings, back to them.
   * The Pool must be unlocked.
   * The user must have deposited funds.  Fires the Withdrawn event.
   */
  function withdrawPool() external;

  /**
   * @notice Calculates a user's winnings.
   * @param _addr The address of the user
   */
  function winnings(address _addr) external view returns (uint256);

  /**
   * @notice Calculates a user's total balance.
   * @return The users's current balance.
   */
  function balanceOf(address _addr) external view returns (uint256);

  function calculateWinner(uint256 entropy) external view returns (address);

  function eligibleSupply() external view returns (uint256);

  /**
   * @notice Computes the entropy used to generate the random number.
   * The blockhash of the lock end block is XOR'd with the secret revealed by the owner.
   * @return The computed entropy value
   */
  function entropy(bytes32 secret) external view returns (uint256);

  function maxPoolSize(int256 blocks) external view returns (int256);

  function estimatedInterestRate(int256 blocks) external view returns (int256);

  /**
   * @notice Extracts the supplyRateMantissa value from the money market contract
   * @return The money market supply rate per block
   */
  function supplyRateMantissa() external view returns (uint256);

  /**
   * @notice Sets the fee fraction paid out to the Pool owner.
   * Fires the FeeFractionChanged event.
   * Can only be called by the owner. Only applies to subsequent Pools.
   * @param _feeFractionFixedPoint18 The fraction to pay out.
   * Must be between 0 and 1 and formatted as a fixed point number with 18 decimals (as in Ether).
   */
  function setFeeFraction(uint256 _feeFractionFixedPoint18) external;
}