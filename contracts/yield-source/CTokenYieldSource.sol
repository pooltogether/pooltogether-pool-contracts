// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@pooltogether/yield-source-interface/contracts/IYieldSource.sol";

import "../external/compound/CTokenInterface.sol";

/// @title Defines the functions used to interact with a yield source.  The Prize Pool inherits this contract.
/// @dev THIS CONTRACT IS EXPERIMENTAL!  USE AT YOUR OWN RISK
/// @notice Prize Pools subclasses need to implement this interface so that yield can be generated.
contract CTokenYieldSource is IYieldSource {
  using SafeMathUpgradeable for uint256;

  event CTokenYieldSourceInitialized(address indexed cToken);

  mapping(address => uint256) public balances;

  /// @notice Interface for the Yield-bearing cToken by Compound
  CTokenInterface public cToken;

  /// @notice Initializes the Yield Service with the Compound cToken
  /// @param _cToken Address of the Compound cToken interface
  constructor (
    CTokenInterface _cToken
  )
    public
  {
    cToken = _cToken;

    emit CTokenYieldSourceInitialized(address(cToken));
  }

  /// @notice Returns the ERC20 asset token used for deposits.
  /// @return The ERC20 asset token
  function depositToken() public override view returns (address) {
    return _tokenAddress();
  }

  function _tokenAddress() internal view returns (address) {
    return cToken.underlying();
  }

  function _token() internal view returns (IERC20Upgradeable) {
    return IERC20Upgradeable(_tokenAddress());
  }

  /// @notice Returns the total balance (in asset tokens).  This includes the deposits and interest.
  /// @return The underlying balance of asset tokens
  function balanceOfToken(address addr) external override returns (uint256) {
    uint256 totalUnderlying = cToken.balanceOfUnderlying(address(this));
    uint256 total = cToken.balanceOf(address(this));
    if (total == 0) {
      return 0;
    }
    return balances[addr].mul(totalUnderlying).div(total);
  }

  /// @notice Supplies asset tokens to the yield source.
  /// @param amount The amount of asset tokens to be supplied
  function supplyTokenTo(uint256 amount, address to) external override {
    _token().transferFrom(msg.sender, address(this), amount);
    IERC20Upgradeable(cToken.underlying()).approve(address(cToken), amount);
    uint256 cTokenBalanceBefore = cToken.balanceOf(address(this));
    require(cToken.mint(amount) == 0, "CTokenYieldSource/mint-failed");
    uint256 cTokenDiff = cToken.balanceOf(address(this)).sub(cTokenBalanceBefore);
    balances[to] = balances[to].add(cTokenDiff);
  }

  /// @notice Redeems asset tokens from the yield source.
  /// @param redeemAmount The amount of yield-bearing tokens to be redeemed
  /// @return The actual amount of tokens that were redeemed.
  function redeemToken(uint256 redeemAmount) external override returns (uint256) {
    uint256 cTokenBalanceBefore = cToken.balanceOf(address(this));
    uint256 balanceBefore = _token().balanceOf(address(this));
    require(cToken.redeemUnderlying(redeemAmount) == 0, "CTokenYieldSource/redeem-failed");
    uint256 cTokenDiff = cTokenBalanceBefore.sub(cToken.balanceOf(address(this)));
    uint256 diff = _token().balanceOf(address(this)).sub(balanceBefore);
    balances[msg.sender] = balances[msg.sender].sub(cTokenDiff);
    _token().transfer(msg.sender, diff);
    return diff;
  }
}
