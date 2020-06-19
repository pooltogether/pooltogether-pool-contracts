pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/utils/Create2.sol";
import "./Depositor.sol";
import "./CustomProxyFactory.sol";

contract DepositorFactory is CustomProxyFactory {

  Depositor depositor;
  PeriodicPrizePoolInterface prizePool;

  function initialize(PeriodicPrizePoolInterface _prizePool) external {
    require(address(_prizePool) != address(0), "DepositorFactory/prize-pool-not-zero");
    depositor = new Depositor();
    prizePool = _prizePool;
  }

  function calculateAddress(address payable user) external view returns (address) {
    return Create2.computeAddress(salt(user), keccak256(deployCode(address(depositor))));
  }

  function deposit(address payable user, bytes calldata data) external {
    Depositor d = Depositor(Create2.deploy(0, salt(user), deployCode(address(depositor))));
    d.deposit(user, prizePool, data);
  }

  function salt(address payable user) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(user));
  }

  function code() external view returns (bytes memory) {
    return deployCode(address(depositor));
  }
}