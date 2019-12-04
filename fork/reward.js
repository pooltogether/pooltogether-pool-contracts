const chalk = require('chalk')
const { buildContext } = require('oz-console')
const { ethers } = require('ethers')
const { exec } = require('./exec')
const chai = require('chai')
const expect = chai.expect

const {
  MULTISIG_ADMIN1
} = require('./constants')

const overrides = {
  gasLimit: 2000000
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

async function reward() {
  const context = buildContext({
    projectConfig: '.openzeppelin/project.json',
    network: process.env.LOCALHOST_URL,
    networkConfig: '.openzeppelin/mainnet.json',
    directory: 'build/contracts',
    verbose: false
  })

  const {
    provider,
    contracts
  } = context

  const signer = provider.getSigner(MULTISIG_ADMIN1)
  const PoolSai = contracts.PoolSai.connect(signer)
  expect(await PoolSai.isAdmin(MULTISIG_ADMIN1)).to.equal(true)

  let currentOpenDrawId = await PoolSai.currentOpenDrawId()
  let nextDrawId = currentOpenDrawId.add('1')
  let currentCommittedDrawId = await PoolSai.currentCommittedDrawId()

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

  // if no pool is committed
  if (currentCommittedDrawId.toString() === '0') {
    exec(provider, await PoolSai.openNextDraw(secretHash, overrides))
  } else {
    let lastSalt = generateSecret(poolSaltSeed, currentCommittedDrawId)
    let lastSecret = generateSecret(poolSeed, currentCommittedDrawId)
    exec(provider, await PoolSai.rewardAndOpenNextDraw(secretHash, lastSecret, lastSalt, overrides))
  }

  console.log(chalk.green('Done reward.'))
}

module.exports = {
  reward
}