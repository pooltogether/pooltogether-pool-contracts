pragma solidity ^0.6.4;

import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./ControlledToken.sol";

// solium-disable security/no-block-members
contract Loyalty is ControlledToken {
  using SafeMath for uint256;

  uint256 public collateral;

  uint256 internal constant INITIAL_EXCHANGE_RATE_MANTISSA = 1 ether;

  function supply(
    address account,
    uint256 amount
  ) external onlyController {
    uint256 tokens = FixedPoint.divideUintByMantissa(amount, exchangeRateMantissa());
    collateral = collateral.add(amount);
    _mint(account, tokens, "", "");
  }

  function balanceOfUnderlying(address user) external view returns (uint256) {
    return FixedPoint.multiplyUintByMantissa(balanceOf(user), exchangeRateMantissa());
  }

  function increaseCollateral(uint256 amount) external onlyController {
    collateral = collateral.add(amount);
  }

  function redeem(
    address from,
    uint256 amount
  ) external onlyController {
    uint256 tokens = FixedPoint.divideUintByMantissa(amount, exchangeRateMantissa());
    collateral = collateral.sub(amount);
    _burn(from, tokens, "", "");
  }

  function exchangeRateMantissa() public view returns (uint256) {
    if (totalSupply() == 0) {
      return INITIAL_EXCHANGE_RATE_MANTISSA;
    } else {
      return FixedPoint.calculateMantissa(collateral, totalSupply());
    }
  }
}
