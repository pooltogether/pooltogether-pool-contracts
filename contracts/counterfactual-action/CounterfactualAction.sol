pragma solidity ^0.6.4;

import "../periodic-prize-pool/PeriodicPrizePoolInterface.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

contract CounterfactualAction {
  function mintTickets(address payable user, PeriodicPrizePoolInterface prizePool, bytes calldata data) external {
    IERC20 token = prizePool.token();
    uint256 amount = token.balanceOf(address(this));
    token.approve(address(prizePool), amount);
    prizePool.mintTickets(user, amount, data);
    selfdestruct(user);
  }

  function cancel(address payable user, PeriodicPrizePoolInterface prizePool) external {
    IERC20 token = prizePool.token();
    token.transfer(user, token.balanceOf(address(this)));
    selfdestruct(user);
  }
}
