pragma solidity ^0.5.0;

import "./IMoneyMarket.sol";
import "zos-lib/contracts/Initializable.sol";
import "openzeppelin-eth/contracts/token/ERC20/IERC20.sol";

contract MoneyMarketMock is Initializable, IMoneyMarket {
  IERC20 token;
  mapping(address => mapping(address => uint256)) ownerTokenAmounts;

  uint __supplyRateMantissa;

  function initialize (address _token, uint256 _supplyRateMantissa) public initializer {
    require(_token != address(0), "token is not defined");
    token = IERC20(_token);
    __supplyRateMantissa = _supplyRateMantissa;
  }

  function supply(address asset, uint amount) external returns (uint) {
    ownerTokenAmounts[msg.sender][asset] = amount;
    require(token.transferFrom(msg.sender, address(this), amount), "could not transfer tokens");
    return 0;
  }

  function withdraw(address asset, uint requestedAmount) external returns (uint) {
    require(ownerTokenAmounts[msg.sender][asset] > 0, "you must have supplied tokens");
    require(token.transfer(msg.sender, requestedAmount), "could not transfer tokens");
    return 0;
  }

  function getSupplyBalance(address account, address asset) external view returns (uint) {
    return (ownerTokenAmounts[account][asset] * 120) / 100;
  }

  function markets(address) external view returns (
    bool isSupported,
    uint blockNumber,
    address interestRateModel,
    uint totalSupply,
    uint supplyRateMantissa,
    uint supplyIndex,
    uint totalBorrows,
    uint borrowRateMantissa,
    uint borrowIndex) {
    return (
      true,
      uint256(7326061),
      0x8ac03DF808efAe9397A9D95888230eE022B997F4,
      uint256(7126576147819897366779581),
      __supplyRateMantissa, // 2.68% APR
      uint256(1011302587274438147),
      uint256(2421350729421578225307521),
      uint256(44183943555),
      uint256(1028260089452399069)
    );
  }
}
