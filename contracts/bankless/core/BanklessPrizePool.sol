// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "../PrizePool.sol";

contract BanklessPrizePool is PrizePool {
  using SafeMathUpgradeable for uint256;
  using SafeERC20Upgradeable for IERC20Upgradeable;

  event BanklessPrizePoolInitialized(address indexed bank);

  IERC20Upgradeable public bank;

  function initialize (
    ControlledTokenInterface[] memory _controlledTokens,
    uint256 _maxExitFeeMantissa,
    IERC20Upgradeable _bank
  )
    public
    initializer
  {
    PrizePool.initialize(
      _controlledTokens,
      _maxExitFeeMantissa
    );
    bank = _bank;

    emit BanklessPrizePoolInitialized(address(bank));
  }

  function _balance() internal override returns (uint256) {
    return bank.balanceOf(address(this));
  }

  function _canAwardExternal(address _externalToken) internal override view returns (bool) {
    return _externalToken != address(bank);
  }

  function _token() internal override view returns (IERC20Upgradeable) {
    return bank;
  }
}
