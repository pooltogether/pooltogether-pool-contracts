// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "./../../token/ControlledTokenInterface.sol";
import "./../../token/TicketInterface.sol";

/// @title Controlled ERC20 Token
/// @notice ERC20 Tokens with a controller for minting & burning
interface BanklessControlledTokenInterface is ControlledTokenInterface, TicketInterface {}
