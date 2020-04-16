const chalk = require('chalk')
const { ethers } = require('ethers')
const { exec } = require('./exec')
const chai = require('chai')
const expect = chai.expect

const {
  POOL_ADMIN
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

async function rewardAndOpen(context, type = 'sai') {
  console.log(chalk.yellow(`Rewarding ${type} pool...`))

  const {
    provider,
    contracts
  } = context

  const signer = provider.getSigner(POOL_ADMIN)
  let pool

  switch (type.toLowerCase()) {
    case 'dai':
      pool = contracts.PoolDai.connect(signer)
      break
    default:
      pool = contracts.PoolSai.connect(signer)
  }

  expect(await pool.isAdmin(POOL_ADMIN)).to.equal(true)

  let currentOpenDrawId = await pool.currentOpenDrawId()
  let nextDrawId = currentOpenDrawId.add('1')
  let currentCommittedDrawId = await pool.currentCommittedDrawId()

  let poolSeed = process.env.SECRET_SEED
  let poolSaltSeed = process.env.SALT_SEED

  if (!poolSeed || !poolSaltSeed) {
    throw new Error('no seed or salt defined')
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
    await exec(provider, pool.openNextDraw(secretHash, overrides))
  } else {
    let lastSalt = generateSecret(poolSaltSeed, currentCommittedDrawId)
    let lastSecret = generateSecret(poolSeed, currentCommittedDrawId)

    if ((await pool.isLocked())) {
      throw new Error('Pool is already locked')
    }
    await exec(provider, pool.lockTokens())
    await exec(provider, pool.rewardAndOpenNextDraw(secretHash, lastSecret, lastSalt, overrides))

    let draw = await pool.getDraw(currentCommittedDrawId)

    let winnerBalance = await pool.balanceOf(draw.winner)

    console.log(chalk.green(`Address ${draw.winner} won ${ethers.utils.formatEther(draw.netWinnings)} with ${ethers.utils.formatEther(winnerBalance)}`))
  }

  console.log(chalk.green('Done reward.'))
}

module.exports = {
  rewardAndOpen
}