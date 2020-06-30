pragma solidity ^0.6.4;

import "../prize-pool/PrizePool.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

contract CounterfactualAction {
  function depositTo(address payable user, PrizePool prizePool, address output) external {
    IERC20 token = prizePool.token();
    uint256 amount = token.balanceOf(address(this));
    token.approve(address(prizePool), amount);
    prizePool.depositTo(user, amount, output);
    selfdestruct(user);
  }

  function cancel(address payable user, PrizePool prizePool) external {
    IERC20 token = prizePool.token();
    token.transfer(user, token.balanceOf(address(this)));
    selfdestruct(user);
  }
}
