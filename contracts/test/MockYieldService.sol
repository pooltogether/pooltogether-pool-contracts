pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "../yield-service/YieldServiceInterface.sol";
import "../token/ControlledToken.sol";
import "../token/TokenControllerInterface.sol";
import "../base/NamedModule.sol";

contract MockYieldService is Initializable, YieldServiceInterface, NamedModule {

  uint256 _balanceOf;
  ControlledToken _token;
  uint256 public supplyRatePerBlock;
  uint256 public override accountedBalance;

  function hashName() public view override returns (bytes32) {
    return ERC1820Constants.YIELD_SERVICE_INTERFACE_HASH;
  }

  function initialize (ModuleManager _manager, ControlledToken token) external initializer {
    setManager(_manager);
    _token = token;
    supplyRatePerBlock = 100 wei;
  }

  function setBalanceOf(uint256 amount) external {
    _balanceOf = amount;
  }

  function balance() external override returns (uint256) {
    return _balanceOf;
  }

  function unaccountedBalance() external override returns (uint256) {
    return _balanceOf - accountedBalance;
  }

  function estimateAccruedInterestOverBlocks(uint256, uint256) external view override returns (uint256) {
    return 45;
  }

  function setSupplyRatePerBlock(uint256 _supplyRatePerBlock) public {
    supplyRatePerBlock = _supplyRatePerBlock;
  }

  function token() external override view returns (IERC20) {
    return _token;
  }

  function supply(address from, uint256 amount) external override {
    // first execute transfer from user to the pool
    bytes memory transferFrom = abi.encodeWithSignature("transferFrom(address,address,uint256)", from, address(manager), amount);
    manager.execTransactionFromModule(address(_token), 0, transferFrom, Enum.Operation.Call);

    accountedBalance = accountedBalance + amount;
  }

  function redeem(address to, uint256 amount) external override {
    // transfer
    bytes memory transfer = abi.encodeWithSignature("transfer(address,uint256)", to, amount);
    manager.execTransactionFromModule(address(_token), 0, transfer, Enum.Operation.Call);

    accountedBalance = accountedBalance - amount;
  }

  function capture(uint256 amount) external override {
    accountedBalance = accountedBalance + amount;
  }
}
