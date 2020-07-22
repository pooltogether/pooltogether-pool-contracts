pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "../../external/compound/CTokenInterface.sol";
import "../PrizePool.sol";

/// @title Prize Pool with Compound's cToken
/// @notice Manages depositing and withdrawing assets from the Prize Pool
contract CompoundPrizePool is PrizePool {
  using SafeMath for uint256;

  /// @notice Interface for the Yield-bearing cToken by Compound
  CTokenInterface public cToken;

  /// @notice Initializes the Prize Pool and Yield Service with the required contract connections
  /// @param _trustedForwarder Address of the Forwarding Contract for GSN Meta-Txs
  /// @param _prizeStrategy Address of the component-controller that manages the prize-strategy
  /// @param _controlledTokens Array of addresses for the Ticket and Sponsorship Tokens controlled by the Prize Pool
  /// @param _maxExitFeeMantissa The maximum exit fee size, relative to the withdrawal amount
  /// @param _maxTimelockDuration The maximum length of time the withdraw timelock could be
  /// @param _cToken Address of the Compound cToken interface
  function initialize (
    address _trustedForwarder,
    PrizeStrategyInterface _prizeStrategy,
    address[] memory _controlledTokens,
    uint256 _maxExitFeeMantissa,
    uint256 _maxTimelockDuration,
    CTokenInterface _cToken
  )
    public
    initializer
  {
    PrizePool.initialize(
      _trustedForwarder,
      _prizeStrategy,
      _controlledTokens,
      _maxExitFeeMantissa,
      _maxTimelockDuration
    );
    cToken = _cToken;
  }

  /// @notice Estimates the accrued interest of a deposit of a given number of blocks
  /// @dev Provides an estimate for the amount of accrued interest that would
  /// be applied to the `principalAmount` over a given number of `blocks`
  /// @param principalAmount The amount of asset tokens to provide an estimate on
  /// @param blocks The number of blocks that the principal would accrue interest over
  /// @return The estimated interest that would accrue on the principal
  function estimateAccruedInterestOverBlocks(
    uint256 principalAmount,
    uint256 blocks
  )
    public
    view
    override
    returns (uint256)
  {
    // estimated = principalAmount * supply rate per block * blocks
    uint256 multiplier = principalAmount.mul(blocks);
    return FixedPoint.multiplyUintByMantissa(multiplier, supplyRatePerBlock());
  }

  /// @dev Gets the current interest-rate the Compound cToken
  /// @return The current exchange-rate
  function supplyRatePerBlock() internal view returns (uint256) {
    (bool success, bytes memory data) = address(cToken).staticcall(abi.encodeWithSignature("supplyRatePerBlock()"));
    require(success, "CompoundPrizePool/supplyRatePerBlock-failed");
    return abi.decode(data, (uint256));
  }

  /// @dev Gets the balance of the underlying assets held by the Yield Service
  /// @return The underlying balance of asset tokens
  function _balance() internal override returns (uint256) {
    return cToken.balanceOfUnderlying(address(this));
  }

  /// @dev Allows a user to supply asset tokens in exchange for yield-bearing tokens
  /// to be held in escrow by the Yield Service
  /// @param amount The amount of asset tokens to be supplied
  function _supply(uint256 amount) internal override {
    IERC20 assetToken = _token();
    assetToken.approve(address(cToken), amount);
    cToken.mint(amount);
  }

  /// @dev Checks with the Prize Pool if a specific token type may be awarded as a prize enhancement
  /// @param _externalToken The address of the token to check
  /// @return True if the token may be awarded, false otherwise
  function _canAwardExternal(address _externalToken) internal override view returns (bool) {
    return _externalToken != address(cToken);
  }

  /// @dev Allows a user to redeem yield-bearing tokens in exchange for the underlying
  /// asset tokens held in escrow by the Yield Service
  /// @param amount The amount of yield-bearing tokens to be redeemed
  function _redeem(uint256 amount) internal override {
    cToken.redeemUnderlying(amount);
  }

  /// @dev Gets the underlying asset token used by the Yield Service
  /// @return A reference to the interface of the underling asset token
  function _token() internal override view returns (IERC20) {
    return IERC20(cToken.underlying());
  }
}
