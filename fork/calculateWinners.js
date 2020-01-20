const chalk = require('chalk')
const { ethers } = require('ethers')
const { exec } = require('./exec')
const chai = require('chai')
const expect = chai.expect

const {
  MULTISIG_ADMIN1
} = require('./helpers/constants')

function generateSecret(poolSeed, drawId) {
  return ethers.utils.solidityKeccak256(
    ['bytes32', 'uint256'],
    [poolSeed, drawId]
  )
}

async function calculateWinners(context, type = 'sai', count = '10') {
  console.log(chalk.yellow(`Calculating next ${count} ${type} pool winners...`))

  count = parseInt(count, 10)

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

  let currentCommittedDrawId = await pool.currentCommittedDrawId()

  let poolSeed = process.env.SECRET_SEED
  let poolSaltSeed = process.env.SALT_SEED
  if (!poolSeed || !poolSaltSeed) {
    console.error('no seed or salt defined')
    return
  }

  for (let i = 0; i < count; i++) {
    currentCommittedDrawId = currentCommittedDrawId.add(ethers.utils.bigNumberify(i))
    // if no pool is committed
    if (currentCommittedDrawId.toString() === '0') {
      console.log(chalk.red('No draw is committed!'))
    } else {
      let lastSecret = generateSecret(poolSeed, currentCommittedDrawId)

      let entropy = ethers.utils.solidityKeccak256(['bytes32'], [lastSecret])

      let winner = await pool.calculateWinner(entropy)

      console.log(chalk.green(`Draw ${currentCommittedDrawId.toString()}: ${winner}`))
    }
  }

  console.log(chalk.green('Done reward.'))
}

module.exports = {
  calculateWinners
}