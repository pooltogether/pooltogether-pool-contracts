// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.6.12;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";

import "../external/maker/DaiInterface.sol";
import "../prize-pool/PrizePoolInterface.sol";

contract PermitAndDepositDai {
  using SafeERC20 for DaiInterface;

  DaiInterface public dai;

  constructor (address _dai) public {
    require(_dai != address(0), "PermitAndDepositDai/dai-not-zero");
    dai = DaiInterface(_dai);
  }

  function permitAndDepositTo(
    // --- Approve by signature ---
    address holder, uint256 nonce, uint256 expiry, bool allowed, uint8 v, bytes32 r, bytes32 s,
    address prizePool, address to, uint256 amount, address controlledToken, address referrer
  ) external {
    dai.permit(holder, address(this), nonce, expiry, allowed, v, r, s);
    dai.safeTransferFrom(holder, address(this), amount);
    dai.approve(address(prizePool), amount);
    PrizePoolInterface(prizePool).depositTo(to, amount, controlledToken, referrer);
  }

}
