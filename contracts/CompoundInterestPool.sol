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

import "@nomiclabs/buidler/console.sol";

/**
 * Wraps a cToken with a principal token.  The principal token represents how much underlying principal a user holds.
 * The interest can be minted as new principal tokens by the allocator.
 */
contract CompoundInterestPool is Initializable, TokenControllerInterface, InterestPoolInterface {
  using SafeMath for uint256;

  event PrincipalSupplied(address from, uint256 amount);
  event PrincipalRedeemed(address to, uint256 amount);
  event PrincipalMinted(address to, uint256 amount);

  CTokenInterface public cToken;
  ControlledToken public override principal;
  IERC20 public override underlying;

  mapping(address => uint256) cTokenBalances;

  function initialize (
    CTokenInterface _cToken,
    ControlledToken _principal
  ) external initializer {
    require(address(_cToken) != address(0), "cToken cannot be zero");
    require(address(_principal) != address(0), "principal cannot be zero");
    require(address(_principal.controller()) == address(this), "principal controller does not match");
    cToken = _cToken;
    underlying = IERC20(_cToken.underlying());
    principal = _principal;
  }

  function balanceOfUnderlying(address user) public view override returns (uint256) {
    return FixedPoint.multiplyUintByMantissa(cTokenBalances[user], exchangeRateCurrent());
  }

  function balanceOfInterest(address user) public view returns (uint256) {
    return balanceOfUnderlying(user).sub(principal.balanceOf(user));
  }

  function supplyUnderlying(uint256 amount) external override {
    underlying.transferFrom(msg.sender, address(this), amount);
    underlying.approve(address(cToken), amount);
    uint256 cTokenBalance = cToken.balanceOf(address(this));
    cToken.mint(amount);
    uint256 difference = cToken.balanceOf(address(this)).sub(cTokenBalance);
    principal.mint(msg.sender, amount);
    cTokenBalances[msg.sender] = cTokenBalances[msg.sender].add(difference);

    emit PrincipalSupplied(msg.sender, amount);
  }

  function cTokenBalanceOf(address user) external view returns (uint256) {
    return cTokenBalances[user];
  }

  function redeemUnderlying(uint256 amount) external override {
    uint256 cTokenBalance = cToken.balanceOf(address(this));
    cToken.redeemUnderlying(amount);
    uint256 difference = cTokenBalance.sub(cToken.balanceOf(address(this)));
    cTokenBalances[msg.sender] = cTokenBalances[msg.sender].sub(difference);
    underlying.transfer(msg.sender, amount);
    principal.burn(msg.sender, amount);

    emit PrincipalRedeemed(msg.sender, amount);
  }

  function mintPrincipal(uint256 amount) external override {
    require(amount <= balanceOfInterest(msg.sender), "exceed-interest");
    principal.mint(msg.sender, amount);
    emit PrincipalMinted(msg.sender, amount);
  }

  function estimateAccruedInterestOverBlocks(uint256 principalAmount, uint256 blocks) public view override returns (uint256) {
    // estimated = principalAmount * supply rate per block * blocks
    uint256 multiplier = principalAmount.mul(blocks);
    return FixedPoint.multiplyUintByMantissa(multiplier, supplyRatePerBlock());
  }

  function exchangeRateCurrent() public view returns (uint256) {
    (bool success, bytes memory data) = address(cToken).staticcall(abi.encodeWithSignature("exchangeRateCurrent()"));
    require(success, "exchangeRateCurrent() failed");
    return abi.decode(data, (uint256));
  }

  function supplyRatePerBlock() public view returns (uint256) {
    (bool success, bytes memory data) = address(cToken).staticcall(abi.encodeWithSignature("supplyRatePerBlock()"));
    require(success, "supplyRatePerBlock failed");
    return abi.decode(data, (uint256));
  }

  function beforeTokenTransfer(address from, address to, uint256 tokenAmount) external override {
    // burn and mint are handled elsewhere.
    if (from == address(0) || to == address(0)) {
      return;
    }

    uint256 cTokenAmount = FixedPoint.multiplyUintByMantissa(tokenAmount, cToken.exchangeRateCurrent());

    cTokenBalances[from] = cTokenBalances[from].sub(cTokenAmount);
    cTokenBalances[to] = cTokenBalances[to].add(cTokenAmount);
  }
}
