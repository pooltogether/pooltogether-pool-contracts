// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.6.12;

/// @title Interface that allows a user to draw an address using an index
interface ReserveInterface {
  function reserveRateMantissa(address prizePool) external view returns (uint256);
}
