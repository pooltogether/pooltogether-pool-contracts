const hardhat = require('hardhat')
const chalk = require("chalk")

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}

const { ethers } = hardhat

const TIMELOCK = '0x42cd8312D2BCe04277dD5161832460e95b24262E'

async function run() {
  const owner = await ethers.provider.getUncheckedSigner('0xa5c3a513645a9a00cb561fed40438e9dfe0d6a69')
  
  dim(`Transferring...`)

  const prizePool = await ethers.getContractAt('StakePrizePool', '0x396b4489da692788e327E2e4b2B0459A5Ef26791', owner)
  await prizePool.transferOwnership(TIMELOCK)

  const prizeStrategy = await ethers.getContractAt('StakePrizePool', '0x21e5e62e0b6b59155110cd36f3f6655fbbcf6424', owner)
  await prizeStrategy.transferOwnership(TIMELOCK)

  green(`Done!`)
}

run()
