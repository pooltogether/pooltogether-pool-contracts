const hardhat = require('hardhat')
const chalk = require("chalk")
const { increaseTime } = require('../../test/helpers/increaseTime')

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function yellow() {
  console.log(chalk.yellow.call(chalk, ...arguments))
}

async function run() {
  const { ethers } = hardhat

  const timelock = await ethers.provider.getUncheckedSigner('0x42cd8312d2bce04277dd5161832460e95b24262e')
  const reserve = await ethers.getContractAt('Reserve', '0xdb8E47BEFe4646fCc62BE61EEE5DF350404c124F', timelock)

  await reserve.setRateMantissa(ethers.utils.parseEther('0.05'))
}

run()
