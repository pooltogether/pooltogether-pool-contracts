// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.6.12;

import "./BeforeAwardListenerInterface.sol";
import "../Constants.sol";
import "./BeforeAwardListenerLibrary.sol";

abstract contract BeforeAwardListener is BeforeAwardListenerInterface {
  function supportsInterface(bytes4 interfaceId) external override view returns (bool) {
    return (
      interfaceId == Constants.ERC165_INTERFACE_ID_ERC165 || 
      interfaceId == BeforeAwardListenerLibrary.ERC165_INTERFACE_ID_BEFORE_AWARD_LISTENER
    );
  }
}