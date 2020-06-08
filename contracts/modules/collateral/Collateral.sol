pragma solidity ^0.6.4;

import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@nomiclabs/buidler/console.sol";

import "../../module-manager/PrizePoolModuleManager.sol";
import "../credit-reserve/CreditReserve.sol";
import "./CollateralInterface.sol";
import "../../base/NamedModule.sol";
import "../../Constants.sol";

// solium-disable security/no-block-members
contract Collateral is NamedModule, CollateralInterface, ERC20UpgradeSafe {
  using SafeMath for uint256;

  uint256 internal constant INITIAL_EXCHANGE_RATE_MANTISSA = 1 ether;

  uint256 public totalCreditCollateral;
  uint256 public totalCreditSupply;
  mapping(address => uint256) creditBalances;

  function initialize(
    NamedModuleManager _manager,
    address _trustedForwarder
  ) public initializer {
    construct(_manager, _trustedForwarder);
  }

  function hashName() public view override returns (bytes32) {
    return Constants.COLLATERAL_INTERFACE_HASH;
  }

  function spread(uint256 _collateral) external override {
    totalCreditCollateral = totalCreditCollateral.add(_collateral);
  }

  function supply(
    address _user,
    uint256 _collateral
  ) external override onlyManagerOrModule {
    _mint(_user, _collateral);
  }

  function redeem(
    address from,
    uint256 amount
  ) external override onlyManagerOrModule {
    _burn(from, amount);
  }

  function transfer(
    address from,
    address to,
    uint256 amount
  ) external onlyManagerOrModule {
    _transfer(from, to, amount);
  }

  function balanceOfCredit(address user) public view returns (uint256) {
    return FixedPoint.multiplyUintByMantissa(creditBalances[user], creditExchangeRateMantissa());
  }

  function ratioMantissa(address user) public view returns (uint256) {
    uint256 creditBalance = balanceOfCredit(user);
    return FixedPoint.calculateMantissa(creditBalance.sub(balanceOf(user)), balanceOf(user));
  }

  function creditExchangeRateMantissa() public view returns (uint256) {
    if (totalCreditSupply == 0) {
      return INITIAL_EXCHANGE_RATE_MANTISSA;
    } else {
      return FixedPoint.calculateMantissa(totalCreditCollateral, totalCreditSupply);
    }
  }

  function _beforeTokenTransfer(address from, address to, uint256 amount) internal override onlyManagerOrModule {
    // if minting
    if (from == address(0)) {
      // we must calculate the new shares
      uint256 credit = FixedPoint.divideUintByMantissa(amount, creditExchangeRateMantissa());
      creditBalances[to] = creditBalances[to].add(credit);
      totalCreditSupply = totalCreditSupply.add(credit);
      totalCreditCollateral = totalCreditCollateral.add(amount);

      console.log("minting... %s %s %s", credit, amount, amount);
    // if redeeming or transferring, the from address must reduce their collateralization
    } else {
      uint256 collateralizationRatioMantissa = ratioMantissa(from);
      uint256 interest = FixedPoint.multiplyUintByMantissa(amount, collateralizationRatioMantissa);
      uint256 amountPlusInterest = amount.add(interest);
      uint256 creditAmountPlusInterest = FixedPoint.divideUintByMantissa(amountPlusInterest, creditExchangeRateMantissa());

      // remove their underlying credit for the collateral + interest
      creditBalances[from] = creditBalances[from].sub(creditAmountPlusInterest);

      if (interest > 0) {
        // credit the interest to their reserve
        PrizePoolModuleManager(address(manager)).creditReserve().mint(from, interest);
      }

      if (to != address(0)) {
        // add the collateral to their credit
        uint256 collateralCredit = FixedPoint.divideUintByMantissa(amount, creditExchangeRateMantissa());
        creditBalances[from] = creditBalances[from].add(collateralCredit);

        // remove the interest from the total
        uint256 creditInterest = FixedPoint.divideUintByMantissa(interest, creditExchangeRateMantissa());
        totalCreditCollateral = totalCreditCollateral.add(interest);
        totalCreditSupply = totalCreditSupply.add(creditInterest);
      } else {
        // remove the collateral + interest from the total
        totalCreditCollateral = totalCreditCollateral.sub(amountPlusInterest);
        totalCreditSupply = totalCreditSupply.sub(creditAmountPlusInterest);
      }
    }
  }

  function _msgSender() internal override(ContextUpgradeSafe, NamedModule) virtual view returns (address payable) {
    return BaseRelayRecipient._msgSender();
  }
}
