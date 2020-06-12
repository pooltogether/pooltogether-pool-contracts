pragma solidity ^0.6.4;

import "@openzeppelin/contracts-ethereum-package/contracts/introspection/IERC1820Registry.sol";

library Constants {
  IERC1820Registry public constant REGISTRY = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);

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

  // keccak256("PoolTogetherV3/InterestTrackerInterface")
  bytes32 public constant INTEREST_TRACKER_INTERFACE_HASH =
  0xd024f1a00d323e421da1833cf865a55a44409b62b7315e96bce12d82e75eff6e;

  // keccak256("PoolTogetherV3/SponsorshipCreditInterface")
  bytes32 public constant SPONSORSHIP_CREDIT_INTERFACE_HASH =
  0x65cc06ccca4f9e926e9e293d406c9b96ca68db73c98d6da23a19c26a179ff54a;

  // keccak256("PoolTogetherV3/TicketCreditInterface")
  bytes32 public constant TICKET_CREDIT_INTERFACE_HASH =
  0xc256d403e0180e5f30c32c2bc8e872cd8283e97e05cbf1af15a2c10763ba659a;

  // keccak256("PoolTogetherV3/SponsorshipInterface")
  bytes32 public constant SPONSORSHIP_INTERFACE_HASH =
  0xfdba083ea3843dc5ff273fd3f7fbc2e59baa10a2c2af369fca115112fda76d95;

  // keccak256("PoolTogetherV3/TimelockInterface")
  bytes32 public constant TIMELOCK_INTERFACE_HASH =
  0x42e4d9828bdc3604a980d7d232f855652139270154bf191927d85bcf165e50a5;

  // keccak256("PoolTogetherV3/PrizePoolInterface")
  bytes32 public constant PRIZE_POOL_INTERFACE_HASH =
  0xa9132fceb7d69949767df6f1c2fa3901378dc016d53edf4827074b8fa1271004;
}