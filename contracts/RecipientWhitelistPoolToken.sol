/**
Copyright 2020 PoolTogether Inc.

This file is part of PoolTogether.

PoolTogether is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation under version 3 of the License.

PoolTogether is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with PoolTogether.  If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity 0.5.12;

import "./PoolToken.sol";

/**
 * @title RecipientWhitelistPoolToken
 * @author Brendan Asselstine
 * @notice Allows the pool admins to only allow token transfers to particular addresses.
 */
contract RecipientWhitelistPoolToken is PoolToken {
  /**
   * @notice Whether the whitelist is enabled
   */
  bool internal _recipientWhitelistEnabled;

  /**
   * @notice Whether a recipient has been whitelisted
   */
  mapping(address => bool) internal _recipientWhitelist;

  /**
   * @notice Emitted when the whitelist is enabled or disabled
   * @param admin The admin who affected the change.
   * @param enabled Whether the whitelist was enabled.
   */
  event WhitelistEnabled(address indexed admin, bool enabled);

  /**
   * @notice Emitted when a recipient whitelist status changes.
   * @param admin The admin who affected the change
   * @param recipient The recipient whose whitelisting status was changed
   * @param whitelisted Whether the recipient was whitelisted
   */
  event RecipientWhitelisted(address indexed admin, address indexed recipient, bool whitelisted);

  /**
   * @notice Returns whether the whitelist is enabled.  If enabled, recipients must be whitelisted in order to receive tokens.
   * Otherwise if the whitelist is not enabled anyone is able to receive tokens.
   * @return True if whitelist enabled, false otherwise.
   */
  function recipientWhitelistEnabled() public view returns (bool) {
    return _recipientWhitelistEnabled;
  }

  /**
   * @notice Checks whether a recipient has been whitelisted.  This is irrespective of whether whitelisting is enabled or not.
   * @return True if the recipient has been whitelisted, false otherwise.
   */
  function recipientWhitelisted(address _recipient) public view returns (bool) {
    return _recipientWhitelist[_recipient];
  }

  /**
   * @notice Sets whether recipient whitelisting is enabled.  Only callable by the Pool admin.
   * @param _enabled True if whitelisting should be enabled, false otherwise
   */
  function setRecipientWhitelistEnabled(bool _enabled) public onlyAdmin {
    _recipientWhitelistEnabled = _enabled;

    emit WhitelistEnabled(msg.sender, _enabled);
  }

  /**
   * @notice Sets whether the recipient should be whitelisted.  Only callable by the Pool admin.
   * @param _recipient The recipient to whitelist
   * @param _whitelisted True if the recipient should be whitelisted, false otherwise
   */
  function setRecipientWhitelisted(address _recipient, bool _whitelisted) public onlyAdmin {
    _recipientWhitelist[_recipient] = _whitelisted;

    emit RecipientWhitelisted(msg.sender, _recipient, _whitelisted);
  }

  /**
    * @dev Call from.tokensToSend() if the interface is registered
    * @param operator address operator requesting the transfer
    * @param from address token holder address
    * @param to address recipient address.  Can only be whitelisted addresses, if any
    * @param amount uint256 amount of tokens to transfer
    * @param userData bytes extra information provided by the token holder (if any)
    * @param operatorData bytes extra information provided by the operator (if any)
    */
  function _callTokensToSend(
      address operator,
      address from,
      address to,
      uint256 amount,
      bytes memory userData,
      bytes memory operatorData
  )
      internal
  {
      if (_recipientWhitelistEnabled) {
        require(to == address(0) || _recipientWhitelist[to], "Pool/not-list");
      }
      super._callTokensToSend(operator, from, to, amount, userData, operatorData);
  }

  /**
   * @notice Requires the caller to be the Pool admin
   */
  modifier onlyAdmin() {
    require(pool().isAdmin(msg.sender), "WhitelistToken/is-admin");
    _;
  }
}
