pragma solidity ^0.6.4;

import "../InterestPoolInterface.sol";
import "../ControlledToken.sol";
import "../TokenControllerInterface.sol";

contract MockInterestPool is InterestPoolInterface, TokenControllerInterface {

  uint256 _availableInterest;
  IERC20 public _underlyingToken;
  ControlledToken public override collateral;
  uint256 public supplyRatePerBlock;

  function initialize (IERC20 underlyingToken, ControlledToken _collateral) external {
    collateral = _collateral;
    _underlyingToken = underlyingToken;
    supplyRatePerBlock = 100 wei;
  }

  function setAvailableInterest(uint256 amount) external {
    _availableInterest = amount;
  }

  function availableInterest() external view override returns (uint256) {
    return _availableInterest;
  }

  function estimateAccruedInterestOverBlocks(uint256, uint256) external view override returns (uint256) {
    return 45;
  }

  function accountedBalance() external view override returns (uint256) {
    return collateral.totalSupply();
  }

  function allocateInterest(address to, uint256 amount) external override {
    collateral.mint(to, amount);
  }

  function setSupplyRatePerBlock(uint256 _supplyRatePerBlock) public {
    supplyRatePerBlock = _supplyRatePerBlock;
  }

  function underlying() external override view returns (IERC20) {
    return _underlyingToken;
  }

  function supply(uint256 amount) external override {
    collateral.mint(msg.sender, amount);
  }

  function redeem(uint256 amount) external override {
    collateral.burn(msg.sender, amount);
  }

  function beforeTokenTransfer(address from, address to, uint256 tokenAmount) external override {}
}
