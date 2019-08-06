pragma solidity 0.5.10;

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
    address indexed feeBeneficiary,
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
   * @param feeFraction The new fee fraction encoded as a fixed point 18 decimal
   */
  event NextFeeFractionChanged(uint256 feeFraction);

  /**
   * Emitted when the beneficiary changes
   */
  event NextFeeBeneficiaryChanged(address indexed feeBeneficiary);

  struct Draw {
    uint256 feeFraction; //fixed point 18
    address feeBeneficiary;
    uint256 openedBlock;
    bytes32 secretHash;
  }

  /**
   * @notice Initializes a new Pool contract.
   * @param _admin The admin of the Pool.  They are able to change settings and are set as the owner of new lotteries.
   * @param _cToken The Compound Finance cToken contract to supply and withdraw tokens.
   * @param _feeFraction The fraction of the gross winnings that should be transferred to the owner as the fee.  Is a fixed point 18 number.
   */
  function init (
    address _admin,
    address _cToken,
    uint256 _feeFraction,
    address _feeBeneficiary
  ) external;

  function depositSponsorship(uint256 _amount) external;

  /**
   * @notice Deposits into the pool.  Deposits will become eligible in the next pool.
   */
  function depositPool(uint256 _amount) external;

  function openNextDraw(bytes32 _nextSecretHash) external;

  function rewardAndOpenNextDraw(bytes32 _nextSecretHash, bytes32 _lastSecret) external;

  function withdrawSponsorship(uint256 _amount) external;

  /**
   * @notice Transfers a users deposit, and potential winnings, back to them.
   * The Pool must be unlocked.
   * The user must have deposited funds.  Fires the Withdrawn event.
   */
  function withdrawPool() external;

  function currentOpenDrawId() external view returns (uint256);

  function currentCommittedDrawId() external view returns (uint256);

  function getDraw(uint256 _drawId) external view returns (
    uint256 feeFraction,
    address feeBeneficiary,
    uint256 openedBlock,
    bytes32 secretHash
  );

  function eligibleBalanceOf(address _address) external view returns (uint256);

  /**
   * @notice Calculates a user's total balance.
   * @return The users's current balance.
   */
  function balanceOf(address _address) external view returns (uint256);

  /**
   * @notice Calculates a user's total balance.
   * @return The users's current balance.
   */
  function balanceOfSponsorship(address _addr) external view returns (uint256);

  function calculateWinner(bytes32 _entropy) external view returns (address);

  function eligibleSupply() external view returns (uint256);

  function estimatedInterestRate(uint256 _blocks) external view returns (uint256);

  /**
   * @notice Extracts the supplyRatePerBlock value from the money market contract
   * @return The money market supply rate per block
   */
  function supplyRatePerBlock() external view returns (uint256);

  /**
   * @notice Sets the fee fraction paid out to the Pool owner.
   * Fires the NextFeeFractionChanged event.
   * Can only be called by the owner. Only applies to subsequent Pools.
   * @param _feeFraction The fraction to pay out.
   * Must be between 0 and 1 and formatted as a fixed point number with 18 decimals (as in Ether).
   */
  function setNextFeeFraction(uint256 _feeFraction) external;
  function nextFeeFraction() external returns (uint256);

  function setNextFeeBeneficiary(address _feeBeneficiary) external;
  function nextFeeBeneficiary() external returns (address);

  function cToken() external view returns (address);

  function accountedBalance() external view returns (uint256);
  function balance() external returns (uint256);

  function addAdmin(address _admin) external;

  function isAdmin(address _admin) external view returns (bool);

  function removeAdmin(address _admin) external;
}