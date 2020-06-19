pragma solidity ^0.6.0;

// solium-disable security/no-inline-assembly
// solium-disable security/no-low-level-calls
contract CustomProxyFactory {

  event ProxyCreated(address proxy);

  function deployMinimal(address _logic, bytes memory _data) public returns (address proxy) {
    bytes memory clone = deployCode(_logic);
    assembly {
      proxy := create(0, add(clone, 0x20), 0x37)
    }

    emit ProxyCreated(address(proxy));

    if(_data.length > 0) {
      (bool success,) = proxy.call(_data);
      require(success, "constructor call failed");
    }
  }

  function deployCode(address _logic) public pure returns (bytes memory clone) {
    // Adapted from https://github.com/optionality/clone-factory/blob/32782f82dfc5a00d103a7e61a17a5dedbd1e8e9d/contracts/CloneFactory.sol
    bytes20 targetBytes = bytes20(_logic);
    assembly {
      let size := 0x37
      // allocate output byte array - this could also be done without assembly
      // by using clone = new bytes(size)
      clone := mload(0x40)
      // new "memory end" including padding
      mstore(0x40, add(clone, and(add(add(size, 0x20), 0x1f), not(0x1f))))
      // store length in memory
      mstore(clone, size)
      mstore(add(clone, 0x20), 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
      mstore(add(clone, 0x34), targetBytes)
      mstore(add(clone, 0x48), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
    }
  }
}
