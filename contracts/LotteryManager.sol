pragma solidity ^0.5.0;

import "openzeppelin-eth/contracts/ownership/Ownable.sol";
import "openzeppelin-eth/contracts/math/SafeMath.sol";
import "./Lottery.sol";

/**
 * @title The Lottery Manager contract for PoolTogether.
 * @author Brendan Asselstine
 * @notice Creates Lotteries and ensures that there is only one active Lottery at a time.
 */
contract LotteryManager is Ownable {
  using SafeMath for uint256;

  event LotteryCreated(address indexed lottery, uint256 indexed number, uint256 indexed page);
  event OpenDurationChanged(uint256 duration);
  event BondDurationChanged(uint256 duration);
  event TicketPriceChanged(int256 ticketPrice);
  event FeeFractionChanged(int256 feeFractionFixedPoint18);

  uint256 public constant PAGE_SIZE = 10;

  IMoneyMarket public moneyMarket;
  IERC20 public token;
  Lottery public currentLottery;
  uint256 public openDuration;
  uint256 public bondDuration;
  int256 public ticketPrice;
  int256 private feeFractionFixedPoint18;
  uint256 public lotteryCount;

  /**
   * @notice Initializes a new LotteryManager contract.  Generally called through ZeppelinOS
   * @param _owner The owner of the LotteryManager.  They are able to change settings and are set as the owner of new lotteries.
   * @param _moneyMarket The Compound Finance MoneyMarket contract to supply and withdraw tokens.
   * @param _token The token to use for the Lotteries
   * @param _openDuration The duration between a Lottery's creation and when it can be locked.
   * @param _bondDuration The duration that a Lottery must be locked for.
   */
  function init (
    address _owner,
    address _moneyMarket,
    address _token,
    uint256 _openDuration,
    uint256 _bondDuration,
    int256 _ticketPrice,
    int256 _feeFractionFixedPoint18
  ) public initializer {
    require(_owner != address(0), "owner cannot be the null address");
    require(_moneyMarket != address(0), "money market address is zero");
    require(_token != address(0), "token address is zero");
    Ownable.initialize(_owner);
    token = IERC20(_token);
    moneyMarket = IMoneyMarket(_moneyMarket);

    _setFeeFraction(_feeFractionFixedPoint18);
    _setBondDuration(_bondDuration);
    _setOpenDuration(_openDuration);
    _setTicketPrice(_ticketPrice);
  }

  /**
   * @notice Creates a new Lottery.  There can be no currently active Lottery.  Fires the LotteryCreated event.
   */
  function createLottery() external onlyOwner {
    bool canCreateLottery = address(currentLottery) == address(0) || currentLottery.state() == Lottery.State.COMPLETE;
    require(canCreateLottery, "the last lottery has not completed");
    currentLottery = new Lottery(
      moneyMarket,
      token,
      block.number + openDuration,
      block.number + openDuration + bondDuration,
      ticketPrice,
      feeFractionFixedPoint18
    );
    currentLottery.initialize(owner());
    lotteryCount = lotteryCount.add(1);

    emit LotteryCreated(address(currentLottery), lotteryCount, lotteryCount.div(PAGE_SIZE));
  }

  /**
   * @notice Sets the open duration in blocks for new Lotteries.  Can only be set by the owner.  Fires the OpenDurationChanged event.
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
   * @notice Sets the lock duration in blocks for new Lotteries.  Can only be set by the owner.  Fires the BondDurationChanged event.
   */
  function setBondDuration(uint256 _bondDuration) public onlyOwner {
    _setBondDuration(_bondDuration);
  }

  function _setBondDuration(uint256 _bondDuration) internal {
    require(_bondDuration > 0, "bond duration must be greater than zero");
    bondDuration = _bondDuration;

    emit BondDurationChanged(_bondDuration);
  }

  function setTicketPrice(int256 _ticketPrice) public onlyOwner {
    _setTicketPrice(_ticketPrice);
  }

  function _setTicketPrice(int256 _ticketPrice) internal {
    require(_ticketPrice > 0, "ticket price must be greater than zero");
    ticketPrice = _ticketPrice;

    emit TicketPriceChanged(_ticketPrice);
  }

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
