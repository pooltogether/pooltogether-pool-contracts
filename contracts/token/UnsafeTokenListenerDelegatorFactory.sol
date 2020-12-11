// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "./UnsafeTokenListenerDelegator.sol";
import "../external/openzeppelin/ProxyFactory.sol";

/// @title Controlled ERC20 Token Factory
/// @notice Minimal proxy pattern for creating new Controlled ERC20 Tokens
contract UnsafeTokenListenerDelegatorProxyFactory is ProxyFactory {

  /// @notice Contract template for deploying proxied tokens
  UnsafeTokenListenerDelegator public instance;

  /// @notice Initializes the Factory with an instance of the Controlled ERC20 Token
  constructor () public {
    instance = new UnsafeTokenListenerDelegator();
  }

  /// @notice Creates a new Controlled ERC20 Token as a proxy of the template instance
  /// @return A reference to the new proxied Controlled ERC20 Token
  function create(TokenListenerInterface tokenListener) external returns (UnsafeTokenListenerDelegator) {
    UnsafeTokenListenerDelegator delegator = UnsafeTokenListenerDelegator(deployMinimal(address(instance), ""));
    delegator.initialize(tokenListener);
    return delegator;
  }
}
