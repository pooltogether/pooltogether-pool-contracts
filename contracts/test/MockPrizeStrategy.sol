pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC777/IERC777Recipient.sol";

import "../prize-strategy/PrizeStrategyInterface.sol";
import "../Constants.sol";

contract MockPrizeStrategy is Initializable, PrizeStrategyInterface, IERC777Recipient {
  uint256 public randomNumber;
  uint256 public prize;

  function initialize() public initializer {
    Constants.REGISTRY.setInterfaceImplementer(address(this), Constants.TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
  }

  function award(uint256 _randomNumber, uint256 _prize) external override {
    prize = _prize;
    randomNumber = _randomNumber;
  }

  function tokensReceived(
    address operator,
    address from,
    address to,
    uint256 amount,
    bytes calldata userData,
    bytes calldata operatorData
  ) external override {
  }
}