pragma solidity ^0.5.0;

import "openzeppelin-eth/contracts/ownership/Ownable.sol";
import "./Lottery.sol";

/**
 * @title The Lottery Manager contract for PoolTogether.
 * @author Brendan Asselstine
 * @notice Creates Lotteries and ensures that there is only one active Lottery at a time.
 */
contract LotteryManager is Ownable {
  event LotteryCreated(address lottery);
  event OpenDurationChanged(uint256 duration);
  event BondDurationChanged(uint256 duration);
  event TicketPriceChanged(uint256 ticketPrice);

  IMoneyMarket public moneyMarket;
  IERC20 public token;
  Lottery public currentLottery;
  uint256 public openDuration;
  uint256 public bondDuration;
  uint256 public ticketPrice;

  /**
   * @notice Initializes a new LotteryManager contract.  Generally called through ZeppelinOS
   * @param _owner The owner of the LotteryManager.  They are able to change settings.
   * @param _moneyMarket The Compound MoneyMarket contract to supply and withdraw tokens.
   * @param _token The token to use for the Lotteries
   * @param _openDuration The duration between a Lottery's creation and when it can be locked.
   * @param _bondDuration The duration that a Lottery must be locked for.
   */
  function init (address _owner, address _moneyMarket, address _token, uint256 _openDuration, uint256 _bondDuration) public initializer {
    require(_owner != address(0), "owner cannot be the null address");
    require(_moneyMarket != address(0), "money market address is zero");
    require(_token != address(0), "token address is zero");
    require(_openDuration > 0, "open duration must be greater than zero");
    require(_bondDuration > 0, "bond duration must be greater than zero");

    Ownable.initialize(_owner);
    token = IERC20(_token);
    moneyMarket = IMoneyMarket(_moneyMarket);
    openDuration = _openDuration;
    bondDuration = _bondDuration;
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
      ticketPrice
    );
    currentLottery.initialize(owner());

    emit LotteryCreated(address(currentLottery));
  }

  /**
   * @notice Sets the open duration in blocks for new Lotteries.  Can only be set by the owner.  Fires the OpenDurationChanged event.
   */
  function setOpenDuration(uint256 _openDuration) external onlyOwner {
    require(_openDuration > 0, "open duration must be greater than zero");
    openDuration = _openDuration;

    emit OpenDurationChanged(_openDuration);
  }

  /**
   * @notice Sets the lock duration in blocks for new Lotteries.  Can only be set by the owner.  Fires the BondDurationChanged event.
   */
  function setBondDuration(uint256 _bondDuration) external onlyOwner {
    require(_bondDuration > 0, "bond duration must be greater than zero");
    bondDuration = _bondDuration;

    emit BondDurationChanged(_bondDuration);
  }

  function setticketPrice(uint256 _ticketPrice) external onlyOwner {
    ticketPrice = _ticketPrice;

    emit TicketPriceChanged(_ticketPrice);
  }
}
