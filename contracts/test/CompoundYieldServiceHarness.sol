pragma solidity 0.6.4;

import "../modules/yield-service/CompoundYieldService.sol";

/**
 * Wraps a cToken with a principal token.  The principal token represents how much underlying principal a user holds.
 * The interest can be minted as new principal tokens by the allocator.
 */
contract CompoundYieldServiceHarness is CompoundYieldService {
  function setAccountedBalance(uint256 balance) public {
    accountedBalance = balance;
  }
}
