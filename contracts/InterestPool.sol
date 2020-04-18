pragma solidity 0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "./compound/ICToken.sol";
import "./GovernanceFee.sol";
import "./ControlledToken.sol";
import "./ITokenController.sol";

/**
 * Wraps a cToken with a collateral token.  The collateral token represents how much underlying principal a user holds.
 * The interest can be minted as new collateral tokens by the allocator.
 */
contract InterestPool is Initializable {
  using SafeMath for uint256;

  GovernanceFee public factory;
  ICToken public cToken;
  ControlledToken public collateralTokens;
  address public allocator;

  function initialize (
    GovernanceFee _factory,
    ICToken _cToken,
    ControlledToken _collateralTokens,
    address _allocator
  ) external initializer {
    require(address(_factory) != address(0), "factory cannot be zero");
    require(address(_cToken) != address(0), "cToken cannot be zero");
    require(address(_collateralTokens) != address(0), "collateralTokens cannot be zero");
    require(address(_allocator) != address(0), "prize strategy cannot be zero");
    factory = _factory;
    cToken = _cToken;
    collateralTokens = _collateralTokens;
    allocator = _allocator;
  }

  function calculateCurrentInterest() public view returns (uint256) {
    uint256 balance = balanceOfUnderlying(address(this));
    uint256 totalAccrued = balance.sub(accountedBalance());
    uint256 fee = calculateFee(totalAccrued);
    return totalAccrued.sub(fee);
  }

  function estimateAccruedInterest(uint256 principal, uint256 blocks) public view returns (uint256) {
    // estimated = principal * supply rate per block * blocks
    uint256 multiplier = principal.mul(blocks);
    return FixedPoint.multiplyUintByMantissa(multiplier, supplyRatePerBlock());
  }

  function accountedBalance() public view returns (uint256) {
    return collateralTokens.totalSupply();
  }

  function supplyCollateral(uint256 amount) external {
    _transferToCToken(amount);
    _mintCollateral(msg.sender, amount);
  }

  function redeemCollateral(uint256 amount) external {
    _transferFromCToken(msg.sender, amount);
    _redeemCollateral(msg.sender, amount);
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

  function calculateFee(uint256 totalInterestAccrued) public view returns (uint256) {
    uint256 fee;
    uint256 feeFractionMantissa = factory.feeFractionMantissa();
    if (factory.feeTo() != address(0) && feeFractionMantissa > 0 && totalInterestAccrued > 0) {
      fee = FixedPoint.multiplyUintByMantissa(totalInterestAccrued, feeFractionMantissa);
    }
    return fee;
  }

  function mintInterest(address to) external onlyAllocator returns (uint256 interest) {
    interest = calculateCurrentInterest();
    _mintCollateral(to, interest);
  }

  function _mintCollateral(address to, uint256 amount) internal {
    collateralTokens.mint(to, amount);
  }

  function _redeemCollateral(address from, uint256 amount) internal {
    collateralTokens.burn(from, amount);
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

  function supplyRatePerBlock() public view returns (uint256) {
    (bool success, bytes memory data) = address(cToken).staticcall(abi.encodeWithSignature("supplyRatePerBlock()"));
    require(success, "supplyRatePerBlock failed");
    return abi.decode(data, (uint256));
  }

  function balanceOfUnderlying(address user) public view returns (uint256) {
    (bool success, bytes memory data) = address(cToken).staticcall(abi.encodeWithSignature("balanceOfUnderlying(address)", user));
    require(success, "balanceOfUnderlying failed");
    return abi.decode(data, (uint256));
  }

  function underlyingToken() public view returns (IERC20) {
    return IERC20(cToken.underlying());
  }

  modifier onlyAllocator() {
    require(msg.sender == address(allocator), "only the allocator");
    _;
  }
}
