// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "../token-faucet/TokenFaucet.sol";
import "./ERC20Mintable.sol";

contract EchidnaTokenFaucet {

  TokenFaucet public faucet;
  ERC20Mintable public asset;
  ERC20Mintable public measure;

  uint256 totalAssetsDripped;
  uint256 totalAssetsClaimed;

  constructor() public {
    asset = new ERC20Mintable("Asset Token", "ASSET");
    measure = new ERC20Mintable("Measure Token", "MEAS");
    faucet = new TokenFaucet();
    faucet.initialize(asset, measure, 1 ether);
  }

  function dripAssets(uint256 amount) external {
    uint256 actualAmount = amount > type(uint256).max / 100000 ? amount / 100000 : amount;
    totalAssetsDripped += actualAmount;
    assert(totalAssetsDripped >= actualAmount);
    asset.mint(address(faucet), actualAmount);
  }

  function mint(uint256 amount) external {
    faucet.beforeTokenMint(msg.sender, amount, address(measure), address(0));
    measure.mint(msg.sender, amount);
  }

  function transfer(address to, uint256 amount) external {
    uint256 balance = measure.balanceOf(msg.sender);
    uint256 actualAmount = amount > balance ? balance : amount;
    faucet.beforeTokenTransfer(msg.sender, to, actualAmount, address(measure));
    measure.masterTransfer(msg.sender, to, actualAmount);
  }

  function burn(uint256 amount) external {
    uint256 balance = measure.balanceOf(msg.sender);
    uint256 actualAmount = amount > balance ? balance : amount;
    faucet.beforeTokenTransfer(msg.sender, address(0), actualAmount, address(measure));
    measure.burn(msg.sender, actualAmount);
  }

  function claim() external {
    uint256 claimed = faucet.claim(msg.sender);
    totalAssetsClaimed += claimed;
    assert(totalAssetsClaimed >= claimed);
  }

  /// @dev Invariant: total unclaimed tokens should never exceed the balance held by the faucet
  function echidna_total_unclaimed_lte_balance () external view returns (bool) {
    return faucet.totalUnclaimed() <= asset.balanceOf(address(faucet));
  }

  /// @dev Invariant: the balance of the faucet plus claimed tokens should always equal the total tokens dripped into the faucet
  function echidna_total_dripped_eq_claimed_plus_balance () external view returns (bool) {
    return totalAssetsDripped == (totalAssetsClaimed + asset.balanceOf(address(faucet)));
  }

}