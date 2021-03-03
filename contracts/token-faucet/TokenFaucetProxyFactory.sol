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

  /// @notice Creates a new TokenFaucet
  /// @param _asset The asset to disburse to users
  /// @param _measure The token to use to measure a users portion
  /// @param _dripRatePerSecond The amount of the asset to drip each second
  /// @return A reference to the new proxied TokenFaucet
  function create(
    IERC20Upgradeable _asset,
    IERC20Upgradeable _measure,
    uint256 _dripRatePerSecond
  ) public returns (TokenFaucet) {
    TokenFaucet tokenFaucet = TokenFaucet(deployMinimal(address(instance), ""));
    tokenFaucet.initialize(
      _asset, _measure, _dripRatePerSecond
    );
    tokenFaucet.transferOwnership(msg.sender);
    return tokenFaucet;
  }

  /// @notice Creates a new TokenFaucet and immediately deposits funds
  /// @param _asset The asset to disburse to users
  /// @param _measure The token to use to measure a users portion
  /// @param _dripRatePerSecond The amount of the asset to drip each second
  /// @param _amount The amount of assets to deposit into the faucet
  /// @return A reference to the new proxied TokenFaucet
  function createAndDeposit(
    IERC20Upgradeable _asset,
    IERC20Upgradeable _measure,
    uint256 _dripRatePerSecond,
    uint256 _amount
  ) external returns (TokenFaucet) {
    TokenFaucet faucet = create(_asset, _measure, _dripRatePerSecond);
    _asset.transferFrom(msg.sender, address(faucet), _amount);
  }

  /// @notice Runs claim on all passed comptrollers for a user.
  /// @param user The user to claim for
  /// @param tokenFaucets The tokenFaucets to call claim on.
  function claimAll(address user, TokenFaucet[] calldata tokenFaucets) external {
    for (uint256 i = 0; i < tokenFaucets.length; i++) {
      tokenFaucets[i].claim(user);
    }
  }
}
