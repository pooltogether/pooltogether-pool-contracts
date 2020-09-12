pragma solidity 0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "../../external/yearn/yVault.sol";
import "../PrizePool.sol";

/// @title Prize Pool with Compound's cToken
/// @notice Manages depositing and withdrawing assets from the Prize Pool
contract yVaultPrizePool is PrizePool {
  using SafeMath for uint256;

  event yVaultPrizePoolInitialized(address indexed vault);
  event ReserveRateMantissaSet(uint256 reserveRateMantissa);

  /// @notice Interface for the Yield-bearing cToken by Compound
  yVault public vault;

  /// Amount that is never exposed to the prize
  uint256 public reserveRateMantissa;

  /// @notice Initializes the Prize Pool and Yield Service with the required contract connections
  /// @param _trustedForwarder Address of the Forwarding Contract for GSN Meta-Txs
  /// @param _prizeStrategy Address of the component-controller that manages the prize-strategy
  /// @param _controlledTokens Array of addresses for the Ticket and Sponsorship Tokens controlled by the Prize Pool
  /// @param _maxExitFeeMantissa The maximum exit fee size, relative to the withdrawal amount
  /// @param _maxTimelockDuration The maximum length of time the withdraw timelock could be
  /// @param _vault Address of the yEarn yVault
  function initialize (
    address _trustedForwarder,
    PrizePoolTokenListenerInterface _prizeStrategy,
    ComptrollerInterface _comptroller,
    address[] memory _controlledTokens,
    uint256 _maxExitFeeMantissa,
    uint256 _maxTimelockDuration,
    yVault _vault,
    uint256 _reserveRateMantissa
  )
    public
    initializer
  {
    PrizePool.initialize(
      _trustedForwarder,
      _prizeStrategy,
      _comptroller,
      _controlledTokens,
      _maxExitFeeMantissa,
      _maxTimelockDuration
    );
    vault = _vault;
    reserveRateMantissa = _reserveRateMantissa;

    emit yVaultPrizePoolInitialized(address(vault));
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
    return 0;
  }

  /// @dev Gets the current interest-rate the Compound cToken
  /// @return The current exchange-rate
  function supplyRatePerBlock() internal view returns (uint256) {
    return 0;
  }

  function setReserveRateMantissa(uint256 _reserveRateMantissa) external onlyOwner {
    reserveRateMantissa = _reserveRateMantissa;

    emit ReserveRateMantissaSet(reserveRateMantissa);
  }

  /// @dev Gets the balance of the underlying assets held by the Yield Service
  /// @return The underlying balance of asset tokens
  function _balance() internal override returns (uint256) {
    uint256 total = _sharesToToken(vault.balanceOf(address(this)));
    uint256 reserve = FixedPoint.multiplyUintByMantissa(total, reserveRateMantissa);
    return total.sub(reserve);
  }

  /// @dev Allows a user to supply asset tokens in exchange for yield-bearing tokens
  /// to be held in escrow by the Yield Service
  function _supply(uint256) internal override {
    IERC20 assetToken = _token();
    uint256 amount = assetToken.balanceOf(address(this));
    assetToken.approve(address(vault), amount);
    vault.deposit(amount);
  }

  /// @dev The external token cannot be yDai or Dai
  /// @param _externalToken The address of the token to check
  /// @return True if the token may be awarded, false otherwise
  function _canAwardExternal(address _externalToken) internal override view returns (bool) {
    return _externalToken != address(vault) && _externalToken != vault.token();
  }

  /// @dev Allows a user to redeem yield-bearing tokens in exchange for the underlying
  /// asset tokens held in escrow by the Yield Service
  /// @param amount The amount of underlying tokens to be redeemed
  /// @return The actual amount of tokens transferred
  function _redeem(uint256 amount) internal override returns (uint256) {
    IERC20 token = _token();

    // calculate possible fee
    uint256 reserve = FixedPoint.multiplyUintByMantissa(amount, reserveRateMantissa);

    uint256 shares = _tokenToShares(amount.add(reserve));

    uint256 before = token.balanceOf(address(this));
    vault.withdraw(shares);
    uint256 diff = token.balanceOf(address(this)).sub(before);

    if (diff < amount) {
      // if we got back less, then the fee was greater than the reserve.
      // in this case we return what we got.
      return diff;
    } else {
      // otherwise the reserve covered the fee so just give back the amount.
      return amount;
    }
  }

  function _tokenToShares(uint256 tokens) internal view returns (uint256) {
    /**
      ex. rate = tokens / shares
      => shares = shares_total * (tokens / tokens total)
     */
    return vault.totalSupply().mul(tokens).div(vault.balance());
  }

  function _sharesToToken(uint256 shares) internal view returns (uint256) {
    return (vault.balance().mul(shares)).div(vault.totalSupply());
  }

  /// @dev Gets the underlying asset token used by the Yield Service
  /// @return A reference to the interface of the underling asset token
  function _token() internal override view returns (IERC20) {
    return IERC20(vault.token());
  }
}
