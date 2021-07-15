const hardhat = require('hardhat')
const chalk = require("chalk")
const { USDT_HOLDER } = require('../constants')

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

async function run() {
  const usdtHolder = await ethers.provider.getUncheckedSigner(USDT_HOLDER)
  const builder = await ethers.getContract('PoolWithMultipleWinnersBuilder', usdtHolder)

  dim(`Using PoolWithMultipleWinnersBuilder @ ${builder.address}`)

  const cUSDT = '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9'

  const block = await ethers.provider.getBlock()

  const compoundPrizePoolConfig = {
    cToken: cUSDT,
    maxExitFeeMantissa: ethers.utils.parseEther('0.1').toString()
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

  dim(`Creating Compound Prize Pool...`)

  const tx = await builder.createCompoundMultipleWinners(
    compoundPrizePoolConfig,
    multipleWinnersConfig,
    18
  )

  const address = await getPrizePoolAddressFromBuilderTransaction(tx)
  const prizePool = await ethers.getContractAt('CompoundPrizePool', address, usdtHolder)

  green(`Created PrizePool ${prizePool.address}`)

  await runPoolLifecycle(prizePool, usdtHolder)
}

run()
