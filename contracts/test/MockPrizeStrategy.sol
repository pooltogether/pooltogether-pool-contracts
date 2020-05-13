pragma solidity ^0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";

import "../prize-strategy/PrizeStrategyInterface.sol";
import "../prize-pool/PrizePoolInterface.sol";
import "../util/ERC1820Helper.sol";

contract MockPrizeStrategy is Initializable, PrizeStrategyInterface, ERC1820Helper, IERC777Recipient {
  uint256 public randomNumber;
  uint256 public prize;

  function initialize() public initializer {
    ERC1820_REGISTRY.setInterfaceImplementer(address(this), ERC1820_TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
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