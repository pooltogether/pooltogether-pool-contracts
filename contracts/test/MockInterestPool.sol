pragma solidity ^0.6.4;

import "../InterestPoolInterface.sol";
import "../ControlledToken.sol";
import "../TokenControllerInterface.sol";

contract MockInterestPool is InterestPoolInterface, TokenControllerInterface {

  uint256 _availableInterest;
  IERC20 public _underlyingToken;
  ControlledToken public token;
  uint256 public override supplyRatePerBlock;

  function initialize (IERC20 underlyingToken, ControlledToken _token) external {
    token = _token;
    _underlyingToken = underlyingToken;
    supplyRatePerBlock = 100 wei;
  }

  function setAvailableInterest(uint256 amount) external {
    _availableInterest = amount;
  }

  function availableInterest() external view override returns (uint256) {
    return _availableInterest;
  }

  function estimateAccruedInterest(uint256 principal, uint256 blocks) external view override returns (uint256) {
    return 45;
  }

  function accountedBalance() external view override returns (uint256) {
    return token.totalSupply();
  }

  function allocateInterest(address to, uint256 amount) external override {
    token.mint(to, amount);
  }

  function setSupplyRatePerBlock(uint256 _supplyRatePerBlock) public {
    supplyRatePerBlock = _supplyRatePerBlock;
  }

  function underlyingToken() external override view returns (IERC20) {
    return _underlyingToken;
  }

  function supplyCollateral(uint256 amount) external override {
    token.mint(msg.sender, amount);
  }

  function redeemCollateral(uint256 amount) external override {
    token.burn(msg.sender, amount);
  }

  function beforeTokenTransfer(address from, address to, uint256 tokenAmount) external override {}
}