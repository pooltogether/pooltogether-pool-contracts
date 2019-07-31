pragma solidity ^0.5.0;

interface IPool {

  /**
   * Emitted when "tickets" have been purchased.
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

  event AdminAdded(address indexed admin);
  event AdminRemoved(address indexed admin);

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
    address indexed beneficiary,
    bytes32 secretHash,
    uint256 feeFraction
  );

  event Committed(
    uint256 indexed drawId
  );

  /**
   * Emitted when the pool rewards a winner
   */
  event Rewarded(
    uint256 indexed drawId,
    address indexed winner,
    bytes32 entropy,
    uint256 winnings,
    uint256 fee
  );

  /**
   * Emitted when the fee fraction is changed
   * @param feeFractionFixedPoint18 The new fee fraction encoded as a fixed point 18 decimal
   */
  event FeeFractionChanged(uint256 feeFractionFixedPoint18);

  /**
   * Emitted when the beneficiary changes
   */
  event BeneficiaryChanged(address indexed beneficiary);

  struct Draw {
    uint256 feeFraction; //fixed point 18
    address beneficiary;
    uint256 openedBlock;
    bytes32 secretHash;
  }

  /**
   * @notice Initializes a new Pool contract.
   * @param _admin The admin of the Pool.  They are able to change settings and are set as the owner of new lotteries.
   * @param _moneyMarket The Compound Finance MoneyMarket contract to supply and withdraw tokens.
   * @param _feeFractionFixedPoint18 The fraction of the gross winnings that should be transferred to the owner as the fee.  Is a fixed point 18 number.
   */
  function init (
    address _admin,
    address _moneyMarket,
    uint256 _feeFractionFixedPoint18,
    address _beneficiary
  ) external;

  function depositSponsorship(uint256 totalDepositNonFixed) external;

  /**
   * @notice Deposits into the pool.  Deposits will become eligible in the next pool.
   */
  function depositPool(uint256 totalDepositNonFixed) external;

  function openNextDraw(bytes32 nextSecretHash) external;

  function rewardAndOpenNextDraw(bytes32 nextSecretHash, bytes32 lastSecret) external;

  /**
   * @notice Transfers a users deposit, and potential winnings, back to them.
   * The Pool must be unlocked.
   * The user must have deposited funds.  Fires the Withdrawn event.
   */
  function withdrawPool() external;

  function currentOpenDrawId() external view returns (uint256);

  function currentCommittedDrawId() external view returns (uint256);

  function getDraw(uint256 drawId) external view returns (
    uint256 feeFraction,
    address beneficiary,
    uint256 openedBlock,
    bytes32 secretHash
  );

  /**
   * @notice Calculates a user's total balance.
   * @return The users's current balance.
   */
  function balanceOf(address _addr) external view returns (uint256);

  /**
   * @notice Calculates a user's total balance.
   * @return The users's current balance.
   */
  function balanceOfSponsorship(address _addr) external view returns (uint256);

  function calculateWinner(bytes32 entropy) external view returns (address);

  function eligibleSupply() external view returns (uint256);

  function maxPoolSize(int256 blocks) external view returns (int256);

  /**
   * @notice Calculates the maximum pool size so that it doesn't overflow after earning interest
   * @dev poolSize = totalDeposits + totalDeposits * interest => totalDeposits = poolSize / (1 + interest)
   * @return The maximum size of the pool to be deposited into the money market
   */
  function maxPoolSizeFixedPoint24(int256 blocks, int256 _maxValueFixedPoint24) external view returns (int256);

  function estimatedInterestRate(int256 blocks) external view returns (int256);

  /**
   * @notice Estimates the current effective interest rate using the money market's current supplyRateMantissa and the lock duration in blocks.
   * @return The current estimated effective interest rate
   */
  function currentInterestFractionFixedPoint24(int256 blockDuration) external view returns (int256);

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
  function setNextFeeFraction(uint256 _feeFractionFixedPoint18) external;
  function nextFeeFraction() external returns (uint256);

  function setNextFeeBeneficiary(address _beneficiary) external;
  function nextFeeBeneficiary() external returns (address);

  function cToken() external returns (address);

  function accountedBalance() external returns (uint256);
  function balance() external returns (uint256);
}