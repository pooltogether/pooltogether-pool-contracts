pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./CompoundPrizePool.sol";
import "../../external/openzeppelin/ProxyFactory.sol";

contract CompoundPrizePoolProxyFactory is Initializable, ProxyFactory {

  CompoundPrizePool public instance;

  function initialize () public initializer {
    instance = new CompoundPrizePool();
  }

  function create() external returns (CompoundPrizePool) {
    return CompoundPrizePool(deployMinimal(address(instance), ""));
  }
}
