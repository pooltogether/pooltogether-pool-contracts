pragma solidity 0.6.4;

import "../external/yearn/yVault.sol";
import "./ERC20Mintable.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

contract yVaultMock is yVault {

  ERC20UpgradeSafe private asset;
  uint256 public extraLossMantissa;

  constructor (ERC20Mintable _asset) public {
    asset = _asset;
  }

  function token() external override view returns (address) {
    return address(asset);
  }

  function balance() public override view returns (uint) {
    return asset.balanceOf(address(this));
  }

  function removeLiquidity(uint _amount) external {
    asset.transfer(msg.sender, _amount);
  }

  function setExtraLossMantissa(uint256 _extraLossMantissa) external {
    extraLossMantissa = _extraLossMantissa;
  }

  function deposit(uint _amount) external override {
    uint _pool = balance();
    uint _before = asset.balanceOf(address(this));
    asset.transferFrom(msg.sender, address(this), _amount);
    uint _after = asset.balanceOf(address(this));
    uint diff = _after.sub(_before); // Additional check for deflationary assets
    uint shares = 0;
    if (totalSupply() == 0) {
      shares = diff;
    } else {
      shares = (diff.mul(totalSupply())).div(_pool);
    }
    _mint(msg.sender, shares);
  }

  function withdraw(uint _shares) external override {
    uint withdrawal = (balance().mul(_shares)).div(totalSupply());
    uint256 fee = FixedPoint.multiplyUintByMantissa(withdrawal, 0.05 ether);
    uint256 extraLoss = FixedPoint.multiplyUintByMantissa(withdrawal.sub(fee), extraLossMantissa);
    asset.transfer(msg.sender, withdrawal.sub(fee).sub(extraLoss));
    _burn(msg.sender, _shares);
  }

  function getPricePerFullShare() external override view returns (uint) {
    return balance().mul(1e18).div(totalSupply());
  }
}
