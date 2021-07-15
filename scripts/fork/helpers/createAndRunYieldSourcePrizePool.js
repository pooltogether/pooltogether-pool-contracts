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
  const builder = await ethers.getContract('PoolWithMultipleWinnersBuilder', signer)

  dim(`Using PoolWithMultipleWinnersBuilder @ ${builder.address}`)

  const block = await ethers.provider.getBlock()

  const yieldSourcePrizePoolConfig = {
    yieldSource: yieldSourceAddress,
    maxExitFeeMantissa: ethers.utils.parseEther('0.1')
  }

  const multipleWinnersConfig = {
    rngService: "0xb1D89477d1b505C261bab6e73f08fA834544CD21",
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
