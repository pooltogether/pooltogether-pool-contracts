pragma solidity 0.5.12;

/**
 * @author Brendan Asselstine
 * @notice Users can listen for rewards by registering RewardListeners using ERC1820.  The reward listeners must
 * implement this interface.
 */
interface IRewardListener {
  /**
   * @notice Triggered when the winner is awarded.  This function must not use more than 200,000 gas.
   * @param winner The user that won
   * @param winnings The amount they won
   * @param drawId The draw id that they won
   */
  function rewarded(address winner, uint256 winnings, uint256 drawId) external;
}