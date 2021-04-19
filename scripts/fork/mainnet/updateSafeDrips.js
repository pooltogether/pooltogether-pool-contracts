const hardhat = require('hardhat')
const chalk = require("chalk")

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function yellow() {
  console.log(chalk.yellow.call(chalk, ...arguments))
}

async function run() {
  const { ethers } = hardhat

  const gnosisSafe = await ethers.provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')
  const comptroller = await ethers.getContractAt('Comptroller', '0x4027dE966127af5F015Ea1cfd6293a3583892668', gnosisSafe)

  // this is what the comptroller is actually listening to
  const tokenListenerShimAddress = '0x2F6e61d89d43b3aDa4A909935EE05d8Ca8Db78DE'
  const ticketAddress = '0x334cbb5858417aee161b53ee0d5349ccf54514cf'

  dim(`Updating drips...`)
  await comptroller.updateDrips([[tokenListenerShimAddress, ticketAddress]], gnosisSafe._address, [ticketAddress])
  let claims = await comptroller.balanceOfClaims(gnosisSafe._address, [ticketAddress])
  const claim = claims[0]
  console.log("Claimable balance: ", ethers.utils.formatEther(claim.balance))
}

run()
