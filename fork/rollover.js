const chalk = require('chalk')
const { ethers } = require('ethers')
const { exec } = require('./exec')
const chai = require('chai')
const expect = chai.expect

const {
  MULTISIG_ADMIN1
} = require('./helpers/constants')

const overrides = {
  gasLimit: 6000000
}

function generateSecret(poolSeed, drawId) {
  return ethers.utils.solidityKeccak256(
    ['bytes32', 'uint256'],
    [poolSeed, drawId]
  )
}

function generateSecretHash(secret, salt) {
  return ethers.utils.solidityKeccak256(
    ['bytes32', 'bytes32'],
    [secret, salt]
  )
}

async function rollover(context, type = 'sai') {
  console.log(chalk.yellow(`Rolling over reward for ${type} pool...`))

  const {
    provider,
    contracts
  } = context

  const signer = provider.getSigner(MULTISIG_ADMIN1)
  let pool

  switch (type.toLowerCase()) {
    case 'dai':
      pool = contracts.PoolDai.connect(signer)
      break
    default:
      pool = contracts.PoolSai.connect(signer)
  }

  expect(await pool.isAdmin(MULTISIG_ADMIN1)).to.equal(true)

  let currentOpenDrawId = await pool.currentOpenDrawId()
  let nextDrawId = currentOpenDrawId.add('1')
  let currentCommittedDrawId = await pool.currentCommittedDrawId()

  let poolSeed = process.env.SECRET_SEED
  let poolSaltSeed = process.env.SALT_SEED

  if (!poolSeed || !poolSaltSeed) {
    console.error('no seed or salt defined')
    return
  }

  let secret = generateSecret(poolSeed, nextDrawId)
  let salt = generateSecret(poolSaltSeed, nextDrawId)
  let secretHash = generateSecretHash(secret, salt)

  console.log({
    currentCommittedDrawId: currentCommittedDrawId.toString(),
    currentOpenDrawId: currentOpenDrawId.toString(),
    nextDrawId: nextDrawId.toString()
  })

  // await exec(provider, pool.reward(lastSecret, lastSalt, overrides))
  await exec(provider, pool.rolloverAndOpenNextDraw(secretHash, overrides))

  console.log(chalk.green('Done rollover.'))
}

module.exports = {
  rollover
}