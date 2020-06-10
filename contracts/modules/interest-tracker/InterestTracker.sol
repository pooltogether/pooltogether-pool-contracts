pragma solidity ^0.6.4;

import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@nomiclabs/buidler/console.sol";

import "../../module-manager/PrizePoolModuleManager.sol";
import "../credit/Credit.sol";
import "./InterestTrackerInterface.sol";
import "../../base/NamedModule.sol";
import "../../Constants.sol";

// solium-disable security/no-block-members
contract InterestTracker is NamedModule, InterestTrackerInterface {
  using SafeMath for uint256;

  uint256 internal constant INITIAL_EXCHANGE_RATE_MANTISSA = 1 ether;

  event CollateralSupplied(address indexed operator, address indexed user, uint256 collateral, uint256 shares);
  event CollateralRedeemed(address indexed operator, address indexed user, uint256 collateral, uint256 shares, uint256 interestCredited);
  event InterestAccrued(address indexed operator, uint256 collateral);

  mapping (address => uint256) private contributionShares;
  uint256 private totalContributionShares;
  uint256 public totalContributions;
  mapping(address => uint256) collateralBalances;

  function initialize(
    NamedModuleManager _manager,
    address _trustedForwarder
  ) public initializer {
    construct(_manager, _trustedForwarder);
  }

  function hashName() public view override returns (bytes32) {
    return Constants.INTEREST_TRACKER_INTERFACE_HASH;
  }

  function accrueInterest(uint256 _collateral) external override {
    totalContributions = totalContributions.add(_collateral);

    emit InterestAccrued(_msgSender(), _collateral);
  }

  function supplyCollateral(
    address _user,
    uint256 _collateral
  ) external override onlyManagerOrModule {
    _mintCollateral(_user, _collateral);
  }

  function redeemCollateral(
    address from,
    uint256 amount
  ) external override onlyManagerOrModule {
    _redeemCollateral(from, amount);
  }

  function transferCollateral(
    address from,
    address to,
    uint256 amount
  ) external override onlyManagerOrModule {
    _redeemCollateral(from, amount);
    _mintCollateral(to, amount);
  }

  function _redeemCollateral(address from, uint256 amount) internal {
    require(amount <= collateralBalances[from], "InterestTracker/insuff");

    // want to maintain the collateralization ratio.
    // here we'll have to remove amount/collateralBalance * balanceOfInterest
    uint256 collateralizationRatioMantissa = _interestRatioMantissa(from);

    uint256 interest = FixedPoint.multiplyUintByMantissa(amount, collateralizationRatioMantissa);

    uint256 amountPlusInterest = amount.add(interest);

    uint256 amountPlusInterestShares = FixedPoint.divideUintByMantissa(amountPlusInterest, _exchangeRateMantissa());

    // remove their collateral and interest
    collateralBalances[from] = collateralBalances[from].sub(amount);
    contributionShares[from] = contributionShares[from].sub(amountPlusInterestShares);
    totalContributionShares = totalContributionShares.sub(amountPlusInterestShares);
    totalContributions = totalContributions.sub(amountPlusInterest);
    if (interest > 0) {
      // credit the interest to their reserve
      PrizePoolModuleManager(address(manager)).credit().mint(from, interest);
    }

    emit CollateralRedeemed(_msgSender(), from, amount, amountPlusInterestShares, interest);
  }

  function _mintCollateral(address to, uint256 amount) internal {
    // add the collateral to their credit
    uint256 shares = FixedPoint.divideUintByMantissa(amount, _exchangeRateMantissa());
    collateralBalances[to] = collateralBalances[to].add(amount);
    contributionShares[to] = contributionShares[to].add(shares);
    totalContributions = totalContributions.add(amount);
    totalContributionShares = totalContributionShares.add(shares);

    emit CollateralSupplied(_msgSender(), to, amount, shares);
  }

  function balanceOfInterest(address user) public view override returns (uint256) {
    return _balanceOfInterest(user);
  }

  function balanceOfCollateral(address user) external view override returns (uint256) {
    return collateralBalances[user];
  }

  function balanceOf(address user) external view override returns (uint256) {
    return FixedPoint.multiplyUintByMantissa(contributionShares[user], _exchangeRateMantissa());
  }

  function interestRatioMantissa(address user) external view override returns (uint256) {
    return _interestRatioMantissa(user);
  }

  function exchangeRateMantissa() external view returns (uint256) {
    return _exchangeRateMantissa();
  }

  function _interestRatioMantissa(address user) internal view returns (uint256) {
    return FixedPoint.calculateMantissa(_balanceOfInterest(user), collateralBalances[user]);
  }

  function _balanceOfInterest(address user) internal view returns (uint256) {
    uint256 balance = FixedPoint.multiplyUintByMantissa(contributionShares[user], _exchangeRateMantissa());
    return balance.sub(collateralBalances[user]);
  }

  function _exchangeRateMantissa() internal view returns (uint256) {
    if (totalContributionShares == 0) {
      return INITIAL_EXCHANGE_RATE_MANTISSA;
    } else {
      return FixedPoint.calculateMantissa(totalContributions, totalContributionShares);
    }
  }
}
