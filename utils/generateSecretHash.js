const ethers = require('ethers')

function generateSecretHash(secret, salt) {
  return ethers.utils.solidityKeccak256(
    ['bytes32', 'bytes32'],
    [secret, salt]
  )
}

module.exports = {
  generateSecretHash
}