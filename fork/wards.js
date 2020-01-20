#!/usr/bin/env node
const chalk = require('chalk')
const { exec } = require('./exec')
const { ethers } = require('ethers')
const {
  SAI,
  SAI_JOIN,
  LITTLE_SAI_GUY,
  SCD_MCD_MIGRATION
} = require('./helpers/constants')

const overrides = {
  gasLimit: 6700000
}

async function wards (context) {
  console.log(chalk.yellow(`Starting wards...`))

  const {
    provider,
    contracts,
    artifacts
  } = context

  const user = LITTLE_SAI_GUY
  // const signer = provider.getSigner(user)

  // const sai = new ethers.Contract(SAI, artifacts.ERC20.abi, signer)
  const saiJoin = new ethers.Contract(SAI_JOIN, require('../abis/AuthGemJoin.json'), provider)
  // const scdMcd = new ethers.Contract(SCD_MCD_MIGRATION, artifacts.ScdMcdMigration.abi, signer)

  console.log(chalk.dim(`ScdMcd is ward: ${(await saiJoin.wards(SCD_MCD_MIGRATION)).toString()}`))

  console.log(chalk.green('Completed wards.'))
}

module.exports = {
  wards
}