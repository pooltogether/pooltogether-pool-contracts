pragma solidity 0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "./compound/ICToken.sol";
import "./GovernanceFee.sol";
import "./IPrizeStrategy.sol";
import "./ControlledToken.sol";
import "./ITokenController.sol";

contract PrizePool is Initializable {
  using SafeMath for uint256;

  GovernanceFee public factory;
  ICToken public cToken;
  ControlledToken public vouchers;
  ControlledToken public sponsorship;
  IPrizeStrategy public prizeStrategy;

  uint256 public voucherCTokens;

  function initialize (
    GovernanceFee _factory,
    ICToken _cToken,
    ControlledToken _vouchers,
    ControlledToken _sponsorship,
    IPrizeStrategy _prizeStrategy
  ) external initializer {
    require(address(_factory) != address(0), "factory cannot be zero");
    require(address(_cToken) != address(0), "cToken cannot be zero");
    require(address(_vouchers) != address(0), "vouchers cannot be zero");
    require(address(_sponsorship) != address(0), "sponsorship cannot be zero");
    require(address(_prizeStrategy) != address(0), "prize strategy cannot be zero");
    factory = _factory;
    cToken = _cToken;
    vouchers = _vouchers;
    sponsorship = _sponsorship;
    prizeStrategy = _prizeStrategy;
  }

  function calculateCurrentPrize() public returns (uint256) {
    uint256 balance = cToken.balanceOfUnderlying(address(this));
    uint256 totalAccrued = balance.sub(vouchers.totalSupply()).sub(sponsorship.totalSupply());
    uint256 fee = calculateFee(totalAccrued);
    return totalAccrued.sub(fee);
  }

  function mintVouchers(uint256 amount) external {
    uint256 interest = currentInterest(amount);
    uint256 total = amount.add(interest);
    _transferToCToken(total);
    _mintVouchers(msg.sender, amount);
  }

  function redeemVouchers(uint256 amount) external {
    uint256 interest = currentInterest(amount);
    uint256 total = amount.add(interest);
    _transferFromCToken(msg.sender, total);
    _redeemVouchers(msg.sender, amount);
  }

  function mintSponsorship(uint256 amount) external {
    _transferToCToken(amount);
    sponsorship.mint(msg.sender, amount);
  }

  function redeemSponsorship(uint256 amount) external {
    _transferFromCToken(msg.sender, amount);
    sponsorship.burn(msg.sender, amount);
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

  function currentInterest(uint256 deposit) public view returns (uint256) {
    // We need to know the portion of the interest that is the vouchers.  How much have the voucher cTokens accrued value?
    // total voucher interest = underlyingValue(voucher cTokens) - vouchers
    // interest / deposit = total voucher interest / vouchers => interest = deposit * total voucher interest / vouchers
    uint256 interest;
    uint256 supply = vouchers.totalSupply();
    if (supply > 0) {
      interest = FixedPoint.multiplyUintByMantissa(deposit, FixedPoint.calculateMantissa(totalVoucherInterest(), supply));
    }
    return interest;
  }

  function totalVoucherInterest() public view returns (uint256) {
    // total voucher interest = underlyingValue(voucher cTokens) - vouchers
    return valueOfCTokens(voucherCTokens).sub(vouchers.totalSupply());
  }

  function calculateFee(uint256 totalInterestAccrued) public view returns (uint256) {
    uint256 fee;
    uint256 feeFractionMantissa = factory.feeFractionMantissa();
    if (factory.feeTo() != address(0) && feeFractionMantissa > 0 && totalInterestAccrued > 0) {
      fee = FixedPoint.multiplyUintByMantissa(totalInterestAccrued, feeFractionMantissa);
    }
    return fee;
  }

  function mintPrize(address to) external onlyPrizeStrategy returns (uint256 prize) {
    prize = calculateCurrentPrize();
    _mintVouchers(to, prize);
  }

  function _mintVouchers(address to, uint256 amount) internal {
    uint256 cTokens = cTokenValueOf(amount);
    voucherCTokens = voucherCTokens.add(cTokens);
    vouchers.mint(to, amount);
  }

  function _redeemVouchers(address from, uint256 amount) internal {
    uint256 cTokens = cTokenValueOf(amount);
    voucherCTokens = voucherCTokens.sub(cTokens);
    vouchers.burn(from, amount);
  }

  function cTokenValueOf(uint256 underlyingAmount) public view returns (uint256) {
    return FixedPoint.divideUintByMantissa(underlyingAmount, exchangeRateCurrent());
  }

  function valueOfCTokens(uint256 cTokens) public view returns (uint256) {
    return FixedPoint.multiplyUintByMantissa(cTokens, exchangeRateCurrent());
  }

  function exchangeRateCurrent() public view returns (uint256) {
    (bool success, bytes memory data) = address(cToken).staticcall(abi.encodeWithSignature("exchangeRateCurrent()", ""));
    require(success, "exchange rate failed");
    return abi.decode(data, (uint256));
  }

  function underlyingToken() internal returns (IERC20) {
    return IERC20(cToken.underlying());
  }

  modifier onlyPrizeStrategy() {
    require(msg.sender == address(prizeStrategy), "only the prize strategy");
    _;
  }
}
