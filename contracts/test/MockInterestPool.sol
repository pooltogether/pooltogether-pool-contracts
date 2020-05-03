pragma solidity ^0.6.4;

import "../InterestPoolInterface.sol";
import "../ControlledToken.sol";
import "../TokenControllerInterface.sol";

contract MockInterestPool is InterestPoolInterface, TokenControllerInterface {

  uint256 _availableInterest;
  IERC20 public _underlyingToken;
  ControlledToken public override principal;
  uint256 public supplyRatePerBlock;

  function initialize (IERC20 underlyingToken, ControlledToken _principal) external {
    principal = _principal;
    _underlyingToken = underlyingToken;
    supplyRatePerBlock = 100 wei;
  }

  function setAvailableInterest(uint256 amount) external {
    _availableInterest = amount;
  }

  function balanceOfUnderlying(address user) external view override returns (uint256) {
    return _availableInterest;
  }

  function estimateAccruedInterestOverBlocks(uint256, uint256) external view override returns (uint256) {
    return 45;
  }

  function mintPrincipal(uint256 amount) external override {
    principal.mint(msg.sender, amount);
  }

  function setSupplyRatePerBlock(uint256 _supplyRatePerBlock) public {
    supplyRatePerBlock = _supplyRatePerBlock;
  }

  function underlying() external override view returns (IERC20) {
    return _underlyingToken;
  }

  function supplyUnderlying(uint256 amount) external override {
    principal.mint(msg.sender, amount);
  }

  function redeemUnderlying(uint256 amount) external override {
    principal.burn(msg.sender, amount);
  }

  function beforeTokenTransfer(address from, address to, uint256 tokenAmount) external override {}
}
