pragma solidity ^0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
// import "@nomiclabs/buidler/console.sol";

import "./TicketPool.sol";
import "./PrizeStrategyInterface.sol";

contract SingleRandomWinnerPrizeStrategy is PrizeStrategyInterface {
  using SafeMath for uint256;

  TicketPool ticketPool;
  uint256 currentPrizeBlock;
  uint256 prizePeriodBlocks;

  constructor (
    TicketPool _ticketPool,
    uint256 _prizePeriodBlocks
  ) public {
    require(address(_ticketPool) != address(0), "prize pool must not be zero");
    require(_prizePeriodBlocks > 0, "prize period must be greater than zero");
    ticketPool = _ticketPool;
    prizePeriodBlocks = _prizePeriodBlocks;
    currentPrizeBlock = block.number;
  }

  function calculateExitFee(address, uint256 tickets) public view override returns (uint256) {
    uint256 remainingBlocks = remainingBlocksToPrize();
    // console.log("remaining blocks: %s", remainingBlocks);
    return estimateAccruedInterest(tickets, remainingBlocks);
  }

  function calculateUnlockBlock(address, uint256) public view override returns (uint256) {
    return prizePeriodEndBlock();
  }

  function estimatePrize() public view returns (uint256) {
    return ticketPool.currentPrize().add(estimateRemainingPrize());
  }

  function estimateRemainingPrize() public view returns (uint256) {
    return estimateAccruedInterest(ticketPool.interestPool().accountedBalance(), remainingBlocksToPrize());
  }

  function remainingBlocksToPrize() public view returns (uint256) {
    uint256 finalBlock = prizePeriodEndBlock();
    if (block.number > finalBlock) {
      return 0;
    } else {
      return finalBlock - block.number;
    }
  }

  function estimateAccruedInterest(uint256 principal, uint256 blocks) public view returns (uint256) {
    // estimated = principal * supply rate per block * blocks
    uint256 multiplier = principal.mul(blocks);
    return FixedPoint.multiplyUintByMantissa(multiplier, ticketPool.interestPool().supplyRatePerBlock());
  }

  function award() external onlyPrizePeriodOver {
    address winner = ticketToken().draw(uint256(blockhash(1)));
    uint256 total = ticketPool.currentPrize();
    ticketPool.award(winner, total);
    currentPrizeBlock = block.number;
  }

  function prizePeriodEndBlock() public view returns (uint256) {
    return currentPrizeBlock + prizePeriodBlocks;
  }

  function ticketToken() public view returns (Ticket) {
    return ticketPool.ticketToken();
  }

  modifier onlyPrizePeriodOver() {
    require(block.number >= prizePeriodEndBlock(), "prize period not over");
    _;
  }
}