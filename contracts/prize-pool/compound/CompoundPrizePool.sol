pragma solidity ^0.6.4;

import "../PrizePool.sol";
import "./CompoundYieldService.sol";

/// @title Prize Pool with Compound's cToken
/// @notice Manages depositing and withdrawing assets from the Prize Pool
contract CompoundPrizePool is PrizePool, CompoundYieldService {

  /// @notice Initializes the Prize Pool and Yield Service with the required contract connections
  /// @param _trustedForwarder Address of the Forwarding Contract for GSN Meta-Txs
  /// @param _comptroller Address of the component-controller that manages the prize-strategy
  /// @param _controlledTokens Array of addresses for the Ticket and Sponsorship Tokens controlled by the Prize Pool
  /// @param _cToken Address of the Compound cToken interface
  function initialize (
    address _trustedForwarder,
    ComptrollerInterface _comptroller,
    address[] memory _controlledTokens,
    CTokenInterface _cToken
  )
    public
    initializer
  {
    PrizePool.initialize(
      _trustedForwarder,
      _comptroller,
      _controlledTokens
    );
    cToken = _cToken;
  }
}
