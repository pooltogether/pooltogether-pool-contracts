const { generateHash } = require('./generateHash')
const { generateSecretHash } = require('./generateSecretHash')

function generateAll(secretSeed, saltSeed, drawId) {
  const secret = generateHash(secretSeed, drawId)
  const salt = generateHash(saltSeed, drawId)
  const secretHash = generateSecretHash(secret, salt)
  
  return {
    secret,
    salt,
    secretHash
  }
}

module.exports = {
  generateAll
}