const buidler = require('@nomiclabs/buidler')
const chalk = require("chalk")
const { increaseTime } = require('../../test/helpers/increaseTime')

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function yellow() {
  console.log(chalk.yellow.call(chalk, ...arguments))
}

async function run() {
  const { ethers } = buidler

  const gnosisSafe = await ethers.provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')



  dim(`Time travelling one day into the future...`)
  // increase time by 1 day
  await increaseTime(1 * 24 * 3600)
}

run()
