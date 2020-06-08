pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "./Collateral.sol";
import "../../external/openzeppelin/ProxyFactory.sol";

contract CollateralFactory is Initializable, ProxyFactory {

  Collateral public instance;

  function initialize () public initializer {
    instance = new Collateral();
  }

  function createCollateral() public returns (Collateral) {
    return Collateral(deployMinimal(address(instance), ""));
  }
}