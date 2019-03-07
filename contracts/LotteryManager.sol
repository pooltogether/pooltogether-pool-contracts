pragma solidity ^0.5.0;

import "zos-lib/contracts/Initializable.sol";
import "./Lottery.sol";

contract LotteryManager is Initializable {
  event LotteryCreated(address lottery);

  IMoneyMarket public moneyMarket;
  IERC20 public token;
  Lottery public currentLottery;
  uint256 public openDuration;
  uint256 public bondDuration;

  function initialize (address _moneyMarket, address _token, uint256 _openDuration, uint256 _bondDuration) public initializer {
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
}
