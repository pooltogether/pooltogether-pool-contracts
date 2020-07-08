pragma solidity 0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@nomiclabs/buidler/console.sol";

import "../AbstractYieldService.sol";
import "../../external/compound/CTokenInterface.sol";

/**
 * Wraps a cToken with a principal token.  The principal token represents how much underlying principal a user holds.
 * The interest can be minted as new principal tokens by the allocator.
 */
contract CompoundYieldService is AbstractYieldService {
  using SafeMath for uint256;

  CTokenInterface public cToken;

  function _balance() internal override returns (uint256) {
    return cToken.balanceOfUnderlying(address(this));
  }

  function _supply(uint256 amount) internal override {
    IERC20 token = _token();
    token.approve(address(cToken), amount);
    cToken.mint(amount);

    emit PrincipalSupplied(msg.sender, amount);
  }

  function _canAwardExternal(address _token) internal override view returns (bool) {
    return _token != address(cToken);
  }

  function _redeem(uint256 amount) internal override {
    cToken.redeemUnderlying(amount);

    emit PrincipalRedeemed(msg.sender, amount);
  }

  function estimateAccruedInterestOverBlocks(uint256 principalAmount, uint256 blocks) public view override returns (uint256) {
    // estimated = principalAmount * supply rate per block * blocks
    uint256 multiplier = principalAmount.mul(blocks);
    return FixedPoint.multiplyUintByMantissa(multiplier, supplyRatePerBlock());
  }

  function supplyRatePerBlock() internal view returns (uint256) {
    (bool success, bytes memory data) = address(cToken).staticcall(abi.encodeWithSignature("supplyRatePerBlock()"));
    require(success, "CompoundYieldService/supplyRatePerBlock-failed");
    return abi.decode(data, (uint256));
  }

  function _token() internal override view returns (IERC20) {
    return IERC20(cToken.underlying());
  }
}
