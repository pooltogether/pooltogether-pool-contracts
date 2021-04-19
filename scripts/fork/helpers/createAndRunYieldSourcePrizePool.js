const hardhat = require('hardhat')
const chalk = require("chalk")

const { 
  getPrizePoolAddressFromBuilderTransaction,
  runPoolLifecycle
} = require('../helpers/runPoolLifecycle')

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}

const { ethers } = hardhat

async function createAndRunYieldSourcePrizePool(signer, yieldSourceAddress) {
  const { getNamedAccounts } = hardhat
  const { rng } = await getNamedAccounts()
  const builder = await ethers.getContract('PoolWithMultipleWinnersBuilder', signer)

  dim(`Using PoolWithMultipleWinnersBuilder @ ${builder.address}`)

  const block = await ethers.provider.getBlock()

  const yieldSourcePrizePoolConfig = {
    yieldSource: yieldSourceAddress,
    maxExitFeeMantissa: ethers.utils.parseEther('0.1'),
    maxTimelockDuration: 365 * 24 * 3600
  }

  const multipleWinnersConfig = {
    rngService: rng,
    prizePeriodStart: block.timestamp,
    prizePeriodSeconds: 1,
    ticketName: "TICKET",
    ticketSymbol: "TICK",
    sponsorshipName: "SPONSORSHIP",
    sponsorshipSymbol: "SPON",
    ticketCreditLimitMantissa: ethers.utils.parseEther('0.1'),
    ticketCreditRateMantissa: '166666666666666',
    numberOfWinners: 1,
    splitExternalErc20Awards: false
  }

  dim(`Creating prize pool...`)

  const tx = await builder.createYieldSourceMultipleWinners(
    yieldSourcePrizePoolConfig,
    multipleWinnersConfig,
    18
  )

  const address = await getPrizePoolAddressFromBuilderTransaction(tx)
  const prizePool = await ethers.getContractAt('YieldSourcePrizePool', address, signer)

  green(`Created PrizePool ${prizePool.address}`)

  await runPoolLifecycle(prizePool, signer)
}

module.exports = {
  createAndRunYieldSourcePrizePool
}
