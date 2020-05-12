pragma solidity ^0.6.4;

import "../yield-service/YieldServiceInterface.sol";
import "../token/ControlledToken.sol";
import "../token/TokenControllerInterface.sol";

contract MockYieldService is YieldServiceInterface {

  uint256 _balanceOf;
  ControlledToken _token;
  uint256 public supplyRatePerBlock;

  function initialize (ControlledToken token) external {
    _token = token;
    supplyRatePerBlock = 100 wei;
  }

  function setBalanceOf(uint256 amount) external {
    _balanceOf = amount;
  }

  function balanceOf(address) external override returns (uint256) {
    return _balanceOf;
  }

  function estimateAccruedInterestOverBlocks(uint256, uint256) external view override returns (uint256) {
    return 45;
  }

  function setSupplyRatePerBlock(uint256 _supplyRatePerBlock) public {
    supplyRatePerBlock = _supplyRatePerBlock;
  }

  function token() external override view returns (IERC20) {
    return _token;
  }

  function supply(uint256 amount) external override {
    _token.transferFrom(msg.sender, address(this), amount);
  }

  function redeem(uint256 amount) external override {
    _token.transfer(msg.sender, amount);
  }
}
