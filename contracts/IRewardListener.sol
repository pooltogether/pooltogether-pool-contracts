pragma solidity 0.5.12;

interface IRewardListener {
  function rewarded(address winner, uint256 winnings, uint256 drawId) external;
}