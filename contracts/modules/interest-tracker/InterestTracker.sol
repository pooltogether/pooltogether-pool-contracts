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

  event CollateralSupplied(address indexed user, uint256 collateral, uint256 shares);
  event CollateralRedeemed(address indexed user, uint256 collateral, uint256 shares);
  event InterestCaptured(address indexed operator, uint256 collateral);

  mapping (address => uint256) private balances;
  uint256 public totalSupply;
  uint256 public totalCollateral;
  uint256 public newInterest;

  function initialize(
    NamedModuleManager _manager,
    address _trustedForwarder
  ) public initializer {
    construct(_manager, _trustedForwarder);
  }

  function hashName() public view override returns (bytes32) {
    return Constants.INTEREST_TRACKER_INTERFACE_HASH;
  }

  // Here we mint a user "fair shares" of the total pool of collateral.
  function supplyCollateral(
    uint256 _collateral
  ) external override onlyManagerOrModule returns (uint256) {
    // mint new shares based on current exchange rate
    // console.log("supply collateral %s", _collateral);
    uint256 shares = FixedPoint.divideUintByMantissa(_collateral, _exchangeRateMantissa());
    // console.log("supply collateral shares %s", shares);
    balances[msg.sender] = balances[msg.sender].add(shares);
    totalSupply = totalSupply.add(shares);
    totalCollateral = totalCollateral.add(_collateral);

    emit CollateralSupplied(msg.sender, _collateral, shares);

    return shares;
  }

  // here a user burns their shares of the pool of collateral.  It is expected that the collateral will drop as well
  function redeemCollateral(
    uint256 _collateral
  ) external override onlyManagerOrModule returns (uint256) {
    // console.log("InterestTracker redeemCollateral %s", _collateral);
    uint256 shares = FixedPoint.divideUintByMantissa(_collateral, _exchangeRateMantissa());
    // console.log("InterestTracker shares %s", shares);
    require(shares <= balances[msg.sender], "InterestTracker/insuff");
    // console.log("InterestTracker balances[msg.sender] %s", balances[msg.sender]);
    // console.log("InterestTracker totalSupply %s", totalSupply);
    // console.log("InterestTracker totalCollateral %s", totalCollateral);
    balances[msg.sender] = balances[msg.sender].sub(shares);
    totalSupply = totalSupply.sub(shares);
    totalCollateral = totalCollateral.sub(_collateral);

    emit CollateralRedeemed(msg.sender, _collateral, shares);

    return shares;
  }

  function balanceOfCollateral(address user) external override returns (uint256) {
    return FixedPoint.multiplyUintByMantissa(balances[user], _exchangeRateMantissa());
  }

  function captureInterest() external override returns (uint256) {
    poke();
    uint256 interest = newInterest;
    newInterest = 0;

    emit InterestCaptured(msg.sender, interest);

    return interest;
  }

  function collateralValueOfShares(uint256 shares) external override returns (uint256) {
    return FixedPoint.multiplyUintByMantissa(shares, _exchangeRateMantissa());
  }

  function balanceOf(address user) external override view returns (uint256) {
    return balances[user];
  }

  function exchangeRateMantissa() external override returns (uint256) {
    return _exchangeRateMantissa();
  }

  function _exchangeRateMantissa() internal returns (uint256) {
    // we know the total collateral currently in the system.
    if (totalSupply == 0) {
      return INITIAL_EXCHANGE_RATE_MANTISSA;
    } else {
      poke();
      return FixedPoint.calculateMantissa(totalCollateral, totalSupply);
    }
  }

  function poke() internal {
    YieldServiceInterface yieldService = PrizePoolModuleManager(address(manager)).yieldService();
    uint256 unaccountedBalance = yieldService.unaccountedBalance();
    if (unaccountedBalance > 0) {
      yieldService.capture(unaccountedBalance);
      newInterest = newInterest.add(unaccountedBalance);
      totalCollateral = totalCollateral.add(unaccountedBalance);
    }
  }
}
