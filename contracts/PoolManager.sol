pragma solidity ^0.5.0;

import "openzeppelin-eth/contracts/ownership/Ownable.sol";
import "openzeppelin-eth/contracts/math/SafeMath.sol";
import "./Pool.sol";

/**
 * @title The Pool Manager contract for PoolTogether.
 * @author Brendan Asselstine
 * @notice Creates Pools and ensures that there is only one active Pool at a time.
 */
contract PoolManager is Ownable {
  using SafeMath for uint256;

  event PoolCreated(address indexed pool, uint256 indexed number, uint256 indexed page);
  event OpenDurationChanged(uint256 duration);
  event LockDurationChanged(uint256 duration);
  event TicketPriceChanged(int256 ticketPrice);
  event FeeFractionChanged(int256 feeFractionFixedPoint18);

  uint256 public constant PAGE_SIZE = 10;

  IMoneyMarket public moneyMarket;
  IERC20 public token;
  Pool public currentPool;
  uint256 public openDuration;
  uint256 public lockDuration;
  int256 public ticketPrice;
  int256 private feeFractionFixedPoint18;
  uint256 public poolCount;
  bool public allowLockAnytime;

  /**
   * @notice Initializes a new PoolManager contract.  Generally called through ZeppelinOS
   * @param _owner The owner of the PoolManager.  They are able to change settings and are set as the owner of new lotteries.
   * @param _moneyMarket The Compound Finance MoneyMarket contract to supply and withdraw tokens.
   * @param _token The token to use for the Pools
   * @param _openDuration The duration between a Pool's creation and when it can be locked.
   * @param _lockDuration The duration that a Pool must be locked for.
   */
  function init (
    address _owner,
    address _moneyMarket,
    address _token,
    uint256 _openDuration,
    uint256 _lockDuration,
    int256 _ticketPrice,
    int256 _feeFractionFixedPoint18,
    bool _allowLockAnytime
  ) public initializer {
    require(_owner != address(0), "owner cannot be the null address");
    require(_moneyMarket != address(0), "money market address is zero");
    require(_token != address(0), "token address is zero");
    Ownable.initialize(_owner);
    token = IERC20(_token);
    moneyMarket = IMoneyMarket(_moneyMarket);
    allowLockAnytime = _allowLockAnytime;

    _setFeeFraction(_feeFractionFixedPoint18);
    _setLockDuration(_lockDuration);
    _setOpenDuration(_openDuration);
    _setTicketPrice(_ticketPrice);
  }

  /**
   * @notice Returns information about the LotteryManager
   * @return A tuple containing:
   *    _currentPool (the address of the current pool),
   *    _openDuration (the open duration in blocks to use for the next pool),
   *    _lockDuration (the lock duration in blocks to use for the next pool),
   *    _ticketPrice (the ticket price in DAI for the next pool),
   *    _feeFractionFixedPoint18 (the fee fraction for the next pool),
   *    _poolCount (the number of pools that have been created)
   */
  function getInfo() public view returns (
    address _currentPool,
    uint256 _openDuration,
    uint256 _lockDuration,
    int256 _ticketPrice,
    int256 _feeFractionFixedPoint18,
    uint256 _poolCount
  ) {
    return (
      address(currentPool),
      openDuration,
      lockDuration,
      ticketPrice,
      feeFractionFixedPoint18,
      poolCount
    );
  }

  /**
   * @notice Creates a new Pool.  There can be no current pool, or the current pool must be complete.
   * Fires the PoolCreated event.
   */
  function createPool() external onlyOwner {
    bool canCreatePool = address(currentPool) == address(0) || currentPool.state() == Pool.State.COMPLETE;
    require(canCreatePool, "the last pool has not completed");
    currentPool = new Pool(
      moneyMarket,
      token,
      block.number + openDuration,
      block.number + openDuration + lockDuration,
      ticketPrice,
      feeFractionFixedPoint18,
      allowLockAnytime
    );
    currentPool.initialize(owner());
    poolCount = poolCount.add(1);

    emit PoolCreated(address(currentPool), poolCount, poolCount.div(PAGE_SIZE));
  }

  /**
   * @notice Sets the open duration in blocks for new Pools.
   * Can only be set by the owner.  Fires the OpenDurationChanged event.
   * @param _openDuration The duration, in blocks, that a pool must be open for after it is created.
   */
  function setOpenDuration(uint256 _openDuration) public onlyOwner {
    _setOpenDuration(_openDuration);
  }

  function _setOpenDuration(uint256 _openDuration) internal {
    require(_openDuration > 0, "open duration must be greater than zero");
    openDuration = _openDuration;

    emit OpenDurationChanged(_openDuration);
  }

  /**
   * @notice Sets the lock duration in blocks for new Pools.
   * Can only be set by the owner.  Fires the LockDurationChanged event.
   * @param _lockDuration The duration, in blocks, that new pools must be locked for.
   */
  function setLockDuration(uint256 _lockDuration) public onlyOwner {
    _setLockDuration(_lockDuration);
  }

  function _setLockDuration(uint256 _lockDuration) internal {
    require(_lockDuration > 0, "bond duration must be greater than zero");
    lockDuration = _lockDuration;

    emit LockDurationChanged(_lockDuration);
  }

  /**
   * @notice Sets the ticket price in DAI.  Can only be called by the PoolManager owner.
   */
  function setTicketPrice(int256 _ticketPrice) public onlyOwner {
    _setTicketPrice(_ticketPrice);
  }

  function _setTicketPrice(int256 _ticketPrice) internal {
    require(_ticketPrice > 0, "ticket price must be greater than zero");
    ticketPrice = _ticketPrice;

    emit TicketPriceChanged(_ticketPrice);
  }

  /**
   * @notice Sets the fee fraction paid out to the pool owner. 
   * @param _feeFractionFixedPoint18 The fraction to pay out. 
   * Must be between 0 and 1 and formatted as a fixed point number with 18 decimals (as in Ether).
   * Can only be called by the PoolManager owner.
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
}
