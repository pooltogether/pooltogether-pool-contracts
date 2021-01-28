// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "./ComptrollerV2.sol";
import "../external/openzeppelin/ProxyFactory.sol";

/// @title Stake Prize Pool Proxy Factory
/// @notice Minimal proxy pattern for creating new ComptrollerV2 contracts
contract ComptrollerV2ProxyFactory is ProxyFactory {

  /// @notice Contract template for deploying proxied Comptrollers
  ComptrollerV2 public instance;

  /// @notice Initializes the Factory with an instance of the ComptrollerV2
  constructor () public {
    instance = new ComptrollerV2();
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
  ) external returns (ComptrollerV2) {
    ComptrollerV2 comptroller = ComptrollerV2(deployMinimal(address(instance), ""));
    comptroller.initialize(
      _asset, _measure, _dripRatePerSecond
    );
    comptroller.transferOwnership(msg.sender);
    return comptroller;
  }

  /// @notice Runs claim on all passed comptrollers for a user.
  /// @param user The user to claim for
  /// @param comptrollers The comptrollers to call claim on.
  function claimAll(address user, ComptrollerV2[] calldata comptrollers) external {
    for (uint256 i = 0; i < comptrollers.length; i++) {
      comptrollers[i].claim(user);
    }
  }
}
