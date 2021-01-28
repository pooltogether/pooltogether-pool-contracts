// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "./TokenFaucet.sol";
import "../external/openzeppelin/ProxyFactory.sol";

/// @title Stake Prize Pool Proxy Factory
/// @notice Minimal proxy pattern for creating new TokenFaucet contracts
contract TokenFaucetProxyFactory is ProxyFactory {

  /// @notice Contract template for deploying proxied Comptrollers
  TokenFaucet public instance;

  /// @notice Initializes the Factory with an instance of the TokenFaucet
  constructor () public {
    instance = new TokenFaucet();
  }

  /// @notice Creates a new Comptroller V2
  /// @param _asset The asset to disburse to users
  /// @param _measure The token to use to measure a users portion
  /// @param _dripRatePerSecond The amount of the asset to drip each second
  /// @return A reference to the new proxied Comptroller V2
  function create(
    IERC20Upgradeable _asset,
    IERC20Upgradeable _measure,
    uint256 _dripRatePerSecond
  ) external returns (TokenFaucet) {
    TokenFaucet comptroller = TokenFaucet(deployMinimal(address(instance), ""));
    comptroller.initialize(
      _asset, _measure, _dripRatePerSecond
    );
    comptroller.transferOwnership(msg.sender);
    return comptroller;
  }

  /// @notice Runs claim on all passed comptrollers for a user.
  /// @param user The user to claim for
  /// @param comptrollers The comptrollers to call claim on.
  function claimAll(address user, TokenFaucet[] calldata comptrollers) external {
    for (uint256 i = 0; i < comptrollers.length; i++) {
      comptrollers[i].claim(user);
    }
  }
}
