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
 
  await hre.ethers.provider.send("hardhat_impersonateAccount",["0xdf9eb223bafbe5c5271415c75aecd68c21fe3d7f"])
  const etherRichSigner = await ethers.provider.getUncheckedSigner('0xdf9eb223bafbe5c5271415c75aecd68c21fe3d7f')
  await hre.ethers.provider.send("hardhat_impersonateAccount",["0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f"])
  const gnosisSafe = await ethers.provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')

  dim(`Sending 10 ether to ${gnosisSafe._address}...`)
  await etherRichSigner.sendTransaction({ to: gnosisSafe._address, value: ethers.utils.parseEther('10') })
  
  const prizePool = await ethers.getContractAt('CompoundPrizePool', '0xEBfb47A7ad0FD6e57323C8A42B2E5A6a4F68fc1a', gnosisSafe)
  const prizeStrategy = await ethers.getContractAt('PeriodicPrizeStrategy', await prizePool.prizeStrategy(), gnosisSafe)

  const dai = await ethers.getContractAt('Dai', '0x6b175474e89094c44da98b954eedeac495271d0f', gnosisSafe)
  const depositAmount = ethers.utils.parseEther('1')
  dim(`Approving spend of ${ethers.utils.formatEther(depositAmount)} for ${prizePool.address}...`)
  await dai.approve(prizePool.address, depositAmount)
  dim(`Depositing ${ethers.utils.formatEther(depositAmount)}...`)
  await prizePool.depositTo(gnosisSafe._address, depositAmount, await prizeStrategy.ticket(), ethers.constants.AddressZero)
}

run()
