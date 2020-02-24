pragma solidity 0.5.12;

import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Implementer.sol";
import "../IRewardListener.sol";

contract BrokenRewardListener is IRewardListener, IERC1820Implementer {
  bytes32 constant internal ERC1820_ACCEPT_MAGIC = keccak256(abi.encodePacked("ERC1820_ACCEPT_MAGIC"));

  function rewarded(address, uint256, uint256) external {
    revert("this will never work!");
  }

  function canImplementInterfaceForAddress(bytes32, address) external view returns (bytes32) {
    return ERC1820_ACCEPT_MAGIC;
  }
}