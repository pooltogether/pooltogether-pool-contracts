pragma solidity ^0.5.0;

import "openzeppelin-eth/contracts/ownership/Ownable.sol";
import "./Lottery.sol";

contract LotteryManager is Ownable {
  event LotteryCreated(address lottery);
  event OpenDurationChanged(uint256 _duration);
  event BondDurationChanged(uint256 _duration);

  IMoneyMarket public moneyMarket;
  IERC20 public token;
  Lottery public currentLottery;
  uint256 public openDuration;
  uint256 public bondDuration;

  function init (address _owner, address _moneyMarket, address _token, uint256 _openDuration, uint256 _bondDuration) public initializer {
    Ownable.initialize(_owner);
    require(_token != address(0), "token address is zero");
    token = IERC20(_token);
    require(_moneyMarket != address(0), "money market address is zero");
    moneyMarket = IMoneyMarket(_moneyMarket);
    openDuration = _openDuration;
    bondDuration = _bondDuration;
  }

  function createLottery() external {
    bool canCreateLottery = address(currentLottery) == address(0) || currentLottery.state() == Lottery.State.COMPLETE;
    require(canCreateLottery, "the last lottery has not completed");
    currentLottery = new Lottery(
      moneyMarket,
      token,
      now + openDuration,
      now + openDuration + bondDuration
    );

    emit LotteryCreated(address(currentLottery));
  }

  function setOpenDuration(uint256 _openDuration) external onlyOwner {
    openDuration = _openDuration;

    emit OpenDurationChanged(_openDuration);
  }

  function setBondDuration(uint256 _bondDuration) external onlyOwner {
    bondDuration = _bondDuration;

    emit BondDurationChanged(_bondDuration);
  }
}
