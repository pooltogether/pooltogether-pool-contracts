pragma solidity ^0.6.4;

import "@openzeppelin/contracts/introspection/IERC1820Registry.sol";

contract ERC1820Helper {
  IERC1820Registry constant internal _ERC1820_REGISTRY = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);

  // keccak("PoolTogether/TokenControllerInterface")
  bytes32 internal constant ERC1820_TOKEN_CONTROLLER_INTERFACE_HASH =
  0x88831b143610c1129e74cfaa1592e2d13919001994631da33d11a627e4623ecd;
}