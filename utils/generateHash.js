const ethers = require('ethers')

function generateHash(secret, drawId) {
  return ethers.utils.solidityKeccak256(
    ['bytes32', 'uint256'],
    [secret, drawId]
  )
}

module.exports = {
  generateHash
}