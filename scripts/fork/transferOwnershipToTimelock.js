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
  const gnosisSafe = await ethers.provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')
  
  dim(`Transferring daiPrizePool...`)
  const daiPrizePool = await ethers.getContractAt('CompoundPrizePool', '0xEBfb47A7ad0FD6e57323C8A42B2E5A6a4F68fc1a', gnosisSafe)
  await daiPrizePool.transferOwnership(TIMELOCK)

  dim(`Transferring uniPrizePool...`)
  const uniPrizePool = await ethers.getContractAt('CompoundPrizePool', '0x0650d780292142835F6ac58dd8E2a336e87b4393', gnosisSafe)
  await uniPrizePool.transferOwnership(TIMELOCK)

  dim(`Transferring usdcPrizePool...`)
  const usdcPrizePool = await ethers.getContractAt('CompoundPrizePool', '0xde9ec95d7708b8319ccca4b8bc92c0a3b70bf416', gnosisSafe)
  await usdcPrizePool.transferOwnership(TIMELOCK)

  dim(`Transferring compPrizePool...`)
  const compPrizePool = await ethers.getContractAt('CompoundPrizePool', '0xBC82221e131c082336cf698F0cA3EBd18aFd4ce7', gnosisSafe)
  await compPrizePool.transferOwnership(TIMELOCK)

  dim(`Transferring daiPrizeStrategy...`)
  const daiPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0x178969A87a78597d303C47198c66F68E8be67Dc2', gnosisSafe)
  await daiPrizeStrategy.transferOwnership(TIMELOCK)

  dim(`Transferring uniPrizeStrategy...`)
  const uniPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0xe8726B85236a489a8E84C56c95790d07a368f913', gnosisSafe)
  await uniPrizeStrategy.transferOwnership(TIMELOCK)

  dim(`Transferring usdcPrizeStrategy...`)
  const usdcPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0x3d9946190907ada8b70381b25c71eb9adf5f9b7b', gnosisSafe)
  await usdcPrizeStrategy.transferOwnership(TIMELOCK)

  dim(`Transferring compPrizeStrategy...`)
  const compPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0x3ec4694b65e41f12d6b5d5ba7c2341f4d6859773', gnosisSafe)
  await compPrizeStrategy.transferOwnership(TIMELOCK)

  green(`Done!`)
}

run()
