pragma solidity 0.6.4;

import "../prize-pool/compound/CompoundYieldService.sol";

/**
 * Wraps a cToken with a principal token.  The principal token represents how much underlying principal a user holds.
 * The interest can be minted as new principal tokens by the allocator.
 */
contract CompoundYieldServiceHarness is CompoundYieldService {

  function initialize(CTokenInterface _cToken) public {
    cToken = _cToken;
  }

  function supply(uint256 mintAmount) external {
    _supply(mintAmount);
  }

  function redeem(uint256 redeemAmount) external {
    _redeem(redeemAmount);
  }

}
