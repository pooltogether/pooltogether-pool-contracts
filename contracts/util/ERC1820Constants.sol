pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Registry.sol";

library ERC1820Constants {
  IERC1820Registry public constant REGISTRY = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);

  // keccak("PoolTogether/TokenControllerInterface")
  bytes32 public constant TOKEN_CONTROLLER_INTERFACE_HASH =
  0x88831b143610c1129e74cfaa1592e2d13919001994631da33d11a627e4623ecd;

  // keccak("PoolTogetherV3/YieldServiceInterface")
  bytes32 public constant YIELD_SERVICE_INTERFACE_HASH =
  0x4ed5789bd358cc9b40d603c60561144ea3ac89cb64ba5d7aab9a193d06e99978;

  // keccak256("ERC777TokensSender")
  bytes32 public constant TOKENS_SENDER_INTERFACE_HASH =
  0x29ddb589b1fb5fc7cf394961c1adf5f8c6454761adf795e67fe149f658abe895;

  // keccak256("ERC777TokensRecipient")
  bytes32 public constant TOKENS_RECIPIENT_INTERFACE_HASH =
  0xb281fc8c12954d22544db45de3159a39272895b169a852b314f9cc762e44c53b;

  // keccak256(abi.encodePacked("ERC1820_ACCEPT_MAGIC"));
  bytes32 public constant ACCEPT_MAGIC =
  0xa2ef4600d742022d532d4747cb3547474667d6f13804902513b2ec01c848f4b4;

  // keccak256("PoolTogetherV3/TicketInterface")
  bytes32 public constant TICKET_INTERFACE_HASH =
  0xf22dc5a0b79862d03b1bd7a85ef07c37d8ab6be34838cd9c393ec1d671b9c818;

  // keccak256("PoolTogetherV3/LoyaltyInterface")
  bytes32 public constant LOYALTY_INTERFACE_HASH =
  0x21adbc49851dc9a5421ef4d78427664813502289b1576200510e09bc637502d9;

  // keccak256("PoolTogetherV3/SponsorshipInterface")
  bytes32 public constant SPONSORSHIP_INTERFACE_HASH =
  0xfdba083ea3843dc5ff273fd3f7fbc2e59baa10a2c2af369fca115112fda76d95;

  // keccak256("PoolTogetherV3/TimelockInterface")
  bytes32 public constant TIMELOCK_INTERFACE_HASH =
  0x42e4d9828bdc3604a980d7d232f855652139270154bf191927d85bcf165e50a5;
}