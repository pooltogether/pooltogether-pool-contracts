// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.5.0 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";

import "./ReserveInterface.sol";

/// @title Simple proxy to allow swapping the reserve strategy
contract ReserveProxy is OwnableUpgradeSafe, ReserveInterface {

  event ReserveStrategySet(address indexed strategy);

  ReserveInterface public strategy;

  constructor () public {
    __Ownable_init();
  }

  function setStrategy(
    ReserveInterface _strategy
  )
    external
    onlyOwner
  {
    strategy = _strategy;

    emit ReserveStrategySet(address(strategy));
  }

  function reserveRecipient(address prizePool) external view override returns (address) {
    if (address(strategy) != address(0)) {
      return strategy.reserveRecipient(prizePool);
    }
    return address(0);
  }

  function reserveRateMantissa(address prizePool) external view override returns (uint256) {
    if (address(strategy) != address(0)) {
      return strategy.reserveRateMantissa(prizePool);
    }
    return 0;
  }
}
