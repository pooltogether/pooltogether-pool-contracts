#!/usr/bin/env node
const assert = require('assert')
const chalk = require('chalk')
const { fetchUsers } = require('./fetchUsers')
const { exec } = require('./exec')
const ethers = require('ethers')

const overrides = {
  gasLimit: ethers.utils.bigNumberify("2000000")
}

async function withdraw (context, type) {
  console.log(chalk.yellow(`Starting withdraw for ${type} pool...`))

  const {
    provider,
    artifacts,
    contracts,
    ethers,
  } = context

  let pool

  switch (type) {
    case 'dai':
      pool = contracts.PoolDai
      break
    default:
      pool = contracts.PoolSai
  }

  const users = await fetchUsers(type)

  // Now ensure we can withdraw the top 5
  for (let i = 0; i < users.length; i++) {
    let address = users[i]
    let signer = provider.getSigner(address)
    let signingPool = pool.connect(signer)

    console.log(chalk.dim(`Checking balances for ${address}...`))

    let openBalance = await signingPool.openBalanceOf(address)

    console.log(chalk.dim(`Retrieving committed balance...`))

    let committedBalance = await signingPool.committedBalanceOf(address)

    console.log(chalk.dim(`adding balances...`))

    let balance = openBalance.add(committedBalance)

    if (balance.gt('0x0')) {
      console.log(chalk.yellow(`Withdrawing ${ethers.utils.formatEther(balance)} from ${address}...`))
      await exec(provider, signingPool['withdraw()'](overrides))
      console.log(chalk.green(`Withdrew ${ethers.utils.formatEther(balance)} from ${address}`))
    } else {
      console.log(chalk.dim(`Skipping withdraw because ${address} has no Pool ${type} balance`))
    }
  }

  console.log(chalk.green('Completed withdraw.'))
}

module.exports = {
  withdraw
}