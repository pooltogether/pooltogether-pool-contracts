#!/usr/bin/env node
const chalk = require('chalk')
const { exec } = require('./exec')
const { ethers } = require('ethers')
const {
  SAI,
  DAI,
  LITTLE_SAI_GUY,
  SCD_MCD_MIGRATION
} = require('./helpers/constants')

const overrides = {
  gasLimit: 6700000
}

async function swapSaiToDai (context) {
  console.log(chalk.yellow(`Starting swapSaiToDai...`))

  const {
    provider,
    artifacts
  } = context

  provider.pollingInterval = 500

  const user = LITTLE_SAI_GUY
  const signer = provider.getSigner(user)

  const sai = new ethers.Contract(SAI, artifacts.ERC20.abi, signer)
  const dai = new ethers.Contract(DAI, artifacts.ERC20.abi, signer)
  const scdMcd = new ethers.Contract(SCD_MCD_MIGRATION, artifacts.ScdMcdMigration.abi, signer)

  console.log(chalk.yellow(`Dai balance: ${ethers.utils.formatEther(await dai.balanceOf(user))}`))
  console.log(chalk.yellow(`Sai balance: ${ethers.utils.formatEther(await sai.balanceOf(user))}`))

  const transferAmount = '1'
  console.log(chalk.dim(`Transferring ${ethers.utils.formatEther(transferAmount)} to ${user}`))
  await exec(provider, sai.approve(SCD_MCD_MIGRATION, transferAmount, overrides))
  const { receipt } = await exec(provider, scdMcd.swapSaiToDai(transferAmount, overrides))

  console.log('Swapped: ', receipt.gasUsed.toString())
  console.log(chalk.green(`New dai balance: ${ethers.utils.formatEther(await dai.balanceOf(user))}`))
  console.log(chalk.green('Completed swapSaiToDai.'))
}

module.exports = {
  swapSaiToDai
}