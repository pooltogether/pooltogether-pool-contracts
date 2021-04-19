const hardhat = require('hardhat')
const chalk = require("chalk")
const { increaseTime } = require('../test/helpers/increaseTime')

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function yellow() {
  console.log(chalk.yellow.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}

async function run() {
  const { deployments, ethers } = hardhat
  const { provider } = ethers

  const signers = await ethers.getSigners()

  const d = await deployments.all()
  
  const gnosisSafe = await provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')
  const binance = await provider.getUncheckedSigner('0x564286362092D8e7936f0549571a803B203aAceD')
  dim(`Sending 10 ether to ${gnosisSafe._address}...`)
  await binance.sendTransaction({ to: gnosisSafe._address, value: ethers.utils.parseEther('10') })
  const prizePool = await ethers.getContractAt('CompoundPrizePool', '0xEBfb47A7ad0FD6e57323C8A42B2E5A6a4F68fc1a', gnosisSafe)

  const mw = await ethers.getContractAt('MultipleWinners', "0x178969A87a78597d303C47198c66F68E8be67Dc2", signers[0])

  yellow(`Setting prize strategy on prize pool...`)
  await prizePool.setPrizeStrategy(mw.address)
  dim(`Done!`)
}

run()
