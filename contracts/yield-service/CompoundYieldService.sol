pragma solidity 0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "./YieldServiceInterface.sol";
import "../token/ControlledToken.sol";
import "../token/TokenControllerInterface.sol";
import "../external/compound/CTokenInterface.sol";

/**
 * Wraps a cToken with a principal token.  The principal token represents how much underlying principal a user holds.
 * The interest can be minted as new principal tokens by the allocator.
 */
contract CompoundYieldService is Initializable, YieldServiceInterface {
  using SafeMath for uint256;

  event PrincipalSupplied(address from, uint256 amount);
  event PrincipalRedeemed(address to, uint256 amount);
  event PrincipalMinted(address to, uint256 amount);

  CTokenInterface public cToken;

  mapping(address => uint256) cTokenBalances;

  function initialize (
    CTokenInterface _cToken
  ) external initializer {
    require(address(_cToken) != address(0), "cToken cannot be zero");
    cToken = _cToken;
  }

  function balanceOf(address user) public override returns (uint256) {
    return FixedPoint.multiplyUintByMantissa(cTokenBalances[user], cToken.exchangeRateCurrent());
  }

  function supply(uint256 amount) external override {
    token().transferFrom(msg.sender, address(this), amount);
    token().approve(address(cToken), amount);
    uint256 cTokenBalance = cToken.balanceOf(address(this));
    cToken.mint(amount);
    uint256 difference = cToken.balanceOf(address(this)).sub(cTokenBalance);
    cTokenBalances[msg.sender] = cTokenBalances[msg.sender].add(difference);

    emit PrincipalSupplied(msg.sender, amount);
  }

  function cTokenBalanceOf(address user) external view returns (uint256) {
    return cTokenBalances[user];
  }

  function redeem(uint256 amount) external override {
    uint256 cTokenBalance = cToken.balanceOf(address(this));
    cToken.redeemUnderlying(amount);
    uint256 difference = cTokenBalance.sub(cToken.balanceOf(address(this)));
    cTokenBalances[msg.sender] = cTokenBalances[msg.sender].sub(difference);
    token().transfer(msg.sender, amount);

    emit PrincipalRedeemed(msg.sender, amount);
  }

  function estimateAccruedInterestOverBlocks(uint256 principalAmount, uint256 blocks) public view override returns (uint256) {
    // estimated = principalAmount * supply rate per block * blocks
    uint256 multiplier = principalAmount.mul(blocks);
    return FixedPoint.multiplyUintByMantissa(multiplier, supplyRatePerBlock());
  }

  function supplyRatePerBlock() public view returns (uint256) {
    (bool success, bytes memory data) = address(cToken).staticcall(abi.encodeWithSignature("supplyRatePerBlock()"));
    require(success, "supplyRatePerBlock failed");
    return abi.decode(data, (uint256));
  }

  function token() public view override returns (IERC20) {
    return IERC20(cToken.underlying());
  }
}
