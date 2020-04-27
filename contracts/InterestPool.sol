pragma solidity 0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "./compound/CTokenInterface.sol";
import "./InterestPoolInterface.sol";
import "./ControlledToken.sol";
import "./TokenControllerInterface.sol";
import "./compound/CTokenInterface.sol";

/**
 * Wraps a cToken with a collateral token.  The collateral token represents how much underlying principal a user holds.
 * The interest can be minted as new collateral tokens by the allocator.
 */
contract InterestPool is Initializable, TokenControllerInterface, InterestPoolInterface {
  using SafeMath for uint256;

  // Seconds per block
  uint256 public constant SECONDS_PER_BLOCK = 12;

  event CollateralSupplied(address from, uint256 amount);
  event CollateralRedeemed(address to, uint256 amount);
  event CollateralAllocated(address to, uint256 amount);

  CTokenInterface public cToken;
  ControlledToken public override collateral;
  address public allocator;
  IERC20 public override underlying;

  function initialize (
    CTokenInterface _cToken,
    ControlledToken _collateral,
    address _allocator
  ) external initializer {
    require(address(_cToken) != address(0), "cToken cannot be zero");
    require(address(_collateral) != address(0), "collateral cannot be zero");
    require(address(_allocator) != address(0), "prize strategy cannot be zero");
    require(address(_collateral.controller()) == address(this), "collateral controller does not match");
    cToken = _cToken;
    underlying = IERC20(_cToken.underlying());
    collateral = _collateral;
    allocator = _allocator;
  }

  function availableInterest() public view override returns (uint256) {
    uint256 balance = cToken.balanceOfUnderlying(address(this));
    return balance.sub(accountedBalance());
  }

  function accountedBalance() public view override returns (uint256) {
    return collateral.totalSupply();
  }

  function supply(uint256 amount) external override {
    _transferToCToken(amount);
    collateral.mint(msg.sender, amount);

    emit CollateralSupplied(msg.sender, amount);
  }

  function redeem(uint256 amount) external override {
    _transferFromCToken(msg.sender, amount);
    collateral.burn(msg.sender, amount);

    emit CollateralRedeemed(msg.sender, amount);
  }

  function _transferToCToken(uint256 amount) internal {
    underlying.transferFrom(msg.sender, address(this), amount);
    underlying.approve(address(cToken), amount);
    cToken.mint(amount);
  }

  function _transferFromCToken(address to, uint256 amount) internal {
    cToken.redeemUnderlying(amount);
    underlying.transfer(to, amount);
  }

  function allocateInterest(address to, uint256 amount) external override onlyAllocator {
    require(amount <= availableInterest(), "exceed-interest");
    collateral.mint(to, amount);

    emit CollateralAllocated(to, amount);
  }

  function estimateAccruedInterestOverBlocks(uint256 principal, uint256 blocks) public view override returns (uint256) {
    // estimated = principal * supply rate per block * blocks
    uint256 multiplier = principal.mul(blocks);
    return FixedPoint.multiplyUintByMantissa(multiplier, supplyRatePerBlock());
  }

  function interestTokenValueOf(uint256 underlyingAmount) external view returns (uint256) {
    return FixedPoint.divideUintByMantissa(underlyingAmount, exchangeRateCurrent());
  }

  function valueOfCTokens(uint256 interestTokens) external view returns (uint256) {
    return FixedPoint.multiplyUintByMantissa(interestTokens, exchangeRateCurrent());
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

  function beforeTokenTransfer(address from, address to, uint256 tokenAmount) external override {}

  modifier onlyAllocator() {
    require(msg.sender == address(allocator), "only the allocator");
    _;
  }
}
