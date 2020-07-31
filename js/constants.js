const ethers = require('ethers')

function hash(string) {
  return ethers.utils.solidityKeccak256(['string'], [string])
}

module.exports = {
  TOKENS_SENDER_INTERFACE_HASH: hash('ERC777TokensSender'),

  TOKENS_RECIPIENT_INTERFACE_HASH: hash('ERC777TokensRecipient'),

  ACCEPT_MAGIC: hash('ERC1820_ACCEPT_MAGIC')
}