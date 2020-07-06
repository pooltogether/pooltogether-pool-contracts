pragma solidity ^0.6.4;

import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@nomiclabs/buidler/console.sol";

import "./AbstractYieldService.sol";

// solium-disable security/no-block-members
abstract contract InterestTracker is AbstractYieldService {
  using SafeMath for uint256;

  uint256 internal constant INITIAL_EXCHANGE_RATE_MANTISSA = 1 ether;

  event CollateralSupplied(address indexed user, uint256 collateral, uint256 shares);
  event CollateralRedeemed(address indexed user, uint256 collateral, uint256 shares);
  event InterestCaptured(address indexed operator, uint256 collateral);

  uint256 public interestShareTotalSupply;
  uint256 public totalCollateral;
  uint256 public newInterest;

  // Here we mint a user "fair shares" of the total pool of collateral.
  function supplyCollateral(
    uint256 _collateral
  ) internal returns (uint256) {
    // mint new shares based on current exchange rate
    uint256 shares = FixedPoint.divideUintByMantissa(_collateral, _exchangeRateMantissa());
    interestShareTotalSupply = interestShareTotalSupply.add(shares);
    totalCollateral = totalCollateral.add(_collateral);

    emit CollateralSupplied(msg.sender, _collateral, shares);

    return shares;
  }

  // here a user burns their shares of the pool of collateral.  It is expected that the collateral will drop as well
  function redeemCollateral(
    uint256 _collateral
  ) internal returns (uint256) {
    uint256 shares = FixedPoint.divideUintByMantissa(_collateral, _exchangeRateMantissa());
    require(shares <= interestShareTotalSupply, "InterestTracker/insuff");
    interestShareTotalSupply = interestShareTotalSupply.sub(shares);
    totalCollateral = totalCollateral.sub(_collateral);

    emit CollateralRedeemed(msg.sender, _collateral, shares);

    return shares;
  }

  function captureInterest() internal returns (uint256) {
    _poke();
    uint256 interest = newInterest;
    newInterest = 0;

    emit InterestCaptured(msg.sender, interest);

    return interest;
  }

  function collateralValueOfShares(uint256 shares) public returns (uint256) {
    return _collateralValueOfShares(shares);
  }

  function _collateralValueOfShares(uint256 shares) internal returns (uint256) {
    return FixedPoint.multiplyUintByMantissa(shares, _exchangeRateMantissa());
  }

  function _shareValueOfCollateral(uint256 collateral) internal returns (uint256) {
    return FixedPoint.divideUintByMantissa(collateral, _exchangeRateMantissa());
  }

  function exchangeRateMantissa() external returns (uint256) {
    return _exchangeRateMantissa();
  }

  function _exchangeRateMantissa() internal returns (uint256) {
    // we know the total collateral currently in the system.
    if (interestShareTotalSupply == 0) {
      return INITIAL_EXCHANGE_RATE_MANTISSA;
    } else {
      _poke();
      return FixedPoint.calculateMantissa(totalCollateral, interestShareTotalSupply);
    }
  }

  function poke() external {
    _poke();
  }

  function _poke() internal {
    uint256 unaccountedBalance = _unaccountedBalance();
    if (unaccountedBalance > 0) {
      _capture(unaccountedBalance);
      newInterest = newInterest.add(unaccountedBalance);
      totalCollateral = totalCollateral.add(unaccountedBalance);
    }
  }
}
