pragma solidity 0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "./YieldServiceInterface.sol";
import "../token/ControlledToken.sol";
import "../token/TokenControllerInterface.sol";
import "../external/compound/CTokenInterface.sol";
import "../base/NamedModule.sol";
import "./YieldServiceConstants.sol";

/**
 * Wraps a cToken with a principal token.  The principal token represents how much underlying principal a user holds.
 * The interest can be minted as new principal tokens by the allocator.
 */
contract CompoundYieldService is Initializable, YieldServiceInterface, NamedModule, OwnableUpgradeSafe {
  using SafeMath for uint256;

  event PrincipalSupplied(address operator, address from, uint256 amount);
  event PrincipalRedeemed(address operator, address to, uint256 amount);
  event PrincipalCaptured(address operator, uint256 amount);

  CTokenInterface public cToken;

  uint256 public override accountedBalance;

  function hashName() public view override returns (bytes32) {
    return YieldServiceConstants.ERC1820_YIELD_SERVICE_INTERFACE_HASH;
  }

  function initialize (
    ModuleManager manager,
    CTokenInterface _cToken
  ) external initializer {
    setManager(manager);
    __Ownable_init();
    require(address(_cToken) != address(0), "cToken cannot be zero");
    cToken = _cToken;
    enableInterface();
  }

  function balance() public override returns (uint256) {
    return cToken.balanceOf(address(manager));
  }

  function unaccountedBalance() public override returns (uint256) {
    uint256 underlying = cToken.balanceOfUnderlying(address(this));
    if (underlying >= accountedBalance) {
      return underlying.sub(accountedBalance);
    } else {
      return 0;
    }
  }

  function _msgSender() internal override(ContextUpgradeSafe) virtual view returns (address payable) {
    return msg.sender;
  }

  function supply(address from, uint256 amount) external override onlyManagerOrModule {
    // first execute transfer from user to the pool
    bytes memory transferFrom = abi.encodeWithSignature("transferFrom(address,address,uint256)", from, address(manager), amount);
    manager.execTransactionFromModule(address(token()), 0, transferFrom, Enum.Operation.Call);

    // approve of ctoken spend
    bytes memory approve = abi.encodeWithSignature("approve(address,uint256)", address(cToken), amount);
    manager.execTransactionFromModule(address(token()), 0, approve, Enum.Operation.Call);

    // now mint to cToken
    bytes memory mint = abi.encodeWithSignature("mint(uint256)", amount);
    manager.execTransactionFromModule(address(cToken), 0, mint, Enum.Operation.Call);

    accountedBalance = accountedBalance.add(amount);

    emit PrincipalSupplied(msg.sender, from, amount);
  }

  function redeem(address to, uint256 amount) external override onlyManagerOrModule {
    // first redeem underlying
    bytes memory redeemUnderlying = abi.encodeWithSignature("redeemUnderlying(uint256)", amount);
    manager.execTransactionFromModule(address(cToken), 0, redeemUnderlying, Enum.Operation.Call);

    // transfer
    bytes memory transfer = abi.encodeWithSignature("transfer(address,uint256)", to, amount);
    manager.execTransactionFromModule(address(token()), 0, transfer, Enum.Operation.Call);

    accountedBalance = accountedBalance.sub(amount);

    emit PrincipalRedeemed(msg.sender, to, amount);
  }

  function capture(uint256 amount) external override onlyManagerOrModule {
    require(amount <= unaccountedBalance(), "insuff");
    accountedBalance = accountedBalance.add(amount);

    emit PrincipalCaptured(msg.sender, amount);
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
