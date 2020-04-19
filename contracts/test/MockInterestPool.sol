pragma solidity ^0.6.4;

import "../IInterestPool.sol";
import "../ControlledToken.sol";
import "../ITokenController.sol";

contract MockInterestPool is IInterestPool, ITokenController {

  uint256 _availableInterest;
  IERC20 public _underlyingToken;
  ControlledToken public token;

  function initialize (IERC20 underlyingToken, ControlledToken _token) external {
    token = _token;
    _underlyingToken = underlyingToken;
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

  function supplyRatePerBlock() public view override returns (uint256) {
    return 100 wei;
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