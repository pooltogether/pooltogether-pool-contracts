pragma solidity ^0.6.4;

import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";

import "../token/Meta777.sol";
import "./LoyaltyInterface.sol";
import "../base/NamedModule.sol";
import "../util/ERC1820Constants.sol";

// solium-disable security/no-block-members
contract Loyalty is LoyaltyInterface, Meta777, NamedModule {
  using SafeMath for uint256;

  uint256 public collateral;

  uint256 internal constant INITIAL_EXCHANGE_RATE_MANTISSA = 1 ether;

  function initialize(
    ModuleManager _manager,
    string memory name,
    string memory symbol,
    address _trustedForwarder
  ) public virtual initializer {
    setManager(_manager);
    enableInterface();
    super.initialize(name, symbol, _trustedForwarder);
  }

  function hashName() public view override returns (bytes32) {
    return ERC1820Constants.LOYALTY_INTERFACE_HASH;
  }

  function supply(
    address account,
    uint256 amount
  ) external override onlyManagerOrModule {
    uint256 tokens = FixedPoint.divideUintByMantissa(amount, exchangeRateMantissa());
    collateral = collateral.add(amount);
    _mint(account, tokens, "", "");
  }

  function balanceOfUnderlying(address user) external override view returns (uint256) {
    return FixedPoint.multiplyUintByMantissa(balanceOf(user), exchangeRateMantissa());
  }

  function reward(uint256 amount) external override onlyManagerOrModule {
    collateral = collateral.add(amount);
  }

  function redeem(
    address from,
    uint256 amount
  ) external override onlyManagerOrModule {
    uint256 tokens = FixedPoint.divideUintByMantissa(amount, exchangeRateMantissa());
    collateral = collateral.sub(amount);
    _burn(from, tokens, "", "");
  }

  function exchangeRateMantissa() public view override returns (uint256) {
    if (totalSupply() == 0) {
      return INITIAL_EXCHANGE_RATE_MANTISSA;
    } else {
      return FixedPoint.calculateMantissa(collateral, totalSupply());
    }
  }

  function _beforeTokenTransfer(address operator, address from, address to, uint256) internal override {
    require(from == address(0) || to == address(0), "no transfer allowed");
  }
}
