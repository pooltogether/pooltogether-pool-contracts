const ethers = require('ethers')

function hash(string) {
  return ethers.utils.solidityKeccak256(['string'], [string])
}

module.exports = {
  TOKEN_CONTROLLER_INTERFACE_HASH: hash('PoolTogetherV3/TokenControllerInterface'),

  YIELD_SERVICE_INTERFACE_HASH: hash('PoolTogetherV3/YieldServiceInterface'),

  TOKENS_SENDER_INTERFACE_HASH: hash('ERC777TokensSender'),

  TOKENS_RECIPIENT_INTERFACE_HASH: hash('ERC777TokensRecipient'),

  ACCEPT_MAGIC: hash('ERC1820_ACCEPT_MAGIC'),

  TICKET_INTERFACE_HASH: hash('PoolTogetherV3/TicketInterface'),

  INTEREST_TRACKER_INTERFACE_HASH: hash('PoolTogetherV3/InterestTrackerInterface'),

  CREDIT_INTERFACE_HASH: hash('PoolTogetherV3/CreditInterface'),

  SPONSORSHIP_INTERFACE_HASH: hash('PoolTogetherV3/SponsorshipInterface'),

  TIMELOCK_INTERFACE_HASH: hash('PoolTogetherV3/TimelockInterface'),

  PRIZE_POOL_INTERFACE_HASH: hash('PoolTogetherV3/PrizePoolInterface'),
}