pragma solidity 0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "./compound/ICToken.sol";
import "./ControlledToken.sol";
import "./ITokenController.sol";
import "./IInterestPool.sol";

/**
 * Wraps a cToken with a collateral token.  The collateral token represents how much underlying principal a user holds.
 * The interest can be minted as new collateral tokens by the allocator.
 */
contract InterestPool is Initializable, ITokenController, IInterestPool {
  using SafeMath for uint256;

  ICToken public cToken;
  ControlledToken public collateralTokens;
  address public allocator;

  function initialize (
    ICToken _cToken,
    ControlledToken _collateralTokens,
    address _allocator
  ) external initializer {
    require(address(_cToken) != address(0), "cToken cannot be zero");
    require(address(_collateralTokens) != address(0), "collateralTokens cannot be zero");
    require(address(_allocator) != address(0), "prize strategy cannot be zero");
    cToken = _cToken;
    collateralTokens = _collateralTokens;
    allocator = _allocator;
  }

  function availableInterest() public view override returns (uint256) {
    uint256 balance = balanceOfUnderlying(address(this));
    return balance.sub(accountedBalance());
  }

  function estimateAccruedInterest(uint256 principal, uint256 blocks) public view override returns (uint256) {
    // estimated = principal * supply rate per block * blocks
    uint256 multiplier = principal.mul(blocks);
    return FixedPoint.multiplyUintByMantissa(multiplier, supplyRatePerBlock());
  }

  function accountedBalance() public view override returns (uint256) {
    return collateralTokens.totalSupply();
  }

  function supplyCollateral(uint256 amount) external override {
    _transferToCToken(amount);
    collateralTokens.mint(msg.sender, amount);
  }

  function redeemCollateral(uint256 amount) external override {
    _transferFromCToken(msg.sender, amount);
    collateralTokens.burn(msg.sender, amount);
  }

  function _transferToCToken(uint256 amount) internal {
    IERC20 token = underlyingToken();
    token.transferFrom(msg.sender, address(this), amount);
    token.approve(address(cToken), amount);
    cToken.mint(amount);
  }

  function _transferFromCToken(address to, uint256 amount) internal {
    cToken.redeemUnderlying(amount);
    IERC20 token = underlyingToken();
    token.transfer(to, amount);
  }

  function allocateInterest(address to, uint256 amount) external override onlyAllocator {
    require(amount <= availableInterest(), "exceed-interest");
    collateralTokens.mint(to, amount);
  }

  function cTokenValueOf(uint256 underlyingAmount) external view returns (uint256) {
    return FixedPoint.divideUintByMantissa(underlyingAmount, exchangeRateCurrent());
  }

  function valueOfCTokens(uint256 cTokens) external view returns (uint256) {
    return FixedPoint.multiplyUintByMantissa(cTokens, exchangeRateCurrent());
  }

  function exchangeRateCurrent() public view returns (uint256) {
    (bool success, bytes memory data) = address(cToken).staticcall(abi.encodeWithSignature("exchangeRateCurrent()"));
    require(success, "exchangeRateCurrent failed");
    return abi.decode(data, (uint256));
  }

  function supplyRatePerBlock() public view override returns (uint256) {
    (bool success, bytes memory data) = address(cToken).staticcall(abi.encodeWithSignature("supplyRatePerBlock()"));
    require(success, "supplyRatePerBlock failed");
    return abi.decode(data, (uint256));
  }

  function balanceOfUnderlying(address user) public view returns (uint256) {
    (bool success, bytes memory data) = address(cToken).staticcall(abi.encodeWithSignature("balanceOfUnderlying(address)", user));
    require(success, "balanceOfUnderlying failed");
    return abi.decode(data, (uint256));
  }

  function underlyingToken() public view override returns (IERC20) {
    return IERC20(cToken.underlying());
  }

  function beforeTokenTransfer(address from, address to, uint256 tokenAmount) external override {}

  modifier onlyAllocator() {
    require(msg.sender == address(allocator), "only the allocator");
    _;
  }
}
