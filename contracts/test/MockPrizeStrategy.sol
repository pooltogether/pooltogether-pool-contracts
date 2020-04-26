pragma solidity ^0.6.4;

import "../PrizeStrategyInterface.sol";
import "../TicketPool.sol";

contract MockPrizeStrategy is PrizeStrategyInterface {
  uint256 public exitFee;
  uint256 public unlockTimestamp;
  TicketPool public ticketPool;

  function setExitFee(uint256 _exitFee) external {
    exitFee = _exitFee;
  }

  function setUnlockTimestamp(uint256 _unlockTimestamp) external {
    unlockTimestamp = _unlockTimestamp;
  }

  function setTicketPool(TicketPool _ticketPool) external {
    ticketPool = _ticketPool;
  }

  function calculateExitFee(address, uint256) external view override returns (uint256) {
    return exitFee;
  }

  function calculateUnlockTimestamp(address, uint256) external view override returns (uint256) {
    return unlockTimestamp;
  }

  function award(address user, uint256 amount) external {
    ticketPool.award(user, amount);
  }
}