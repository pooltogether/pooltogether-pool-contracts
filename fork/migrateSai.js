#!/usr/bin/env node
const chalk = require('chalk')
const { expect } = require('chai')
const { fetchUsers } = require('./fetchUsers')
const { exec } = require('./exec')
const { ethers } = require('ethers')

const overrides = {
  gasLimit: 5000000
}

async function migrateSai (context, count = '1') {
  console.log(chalk.yellow(`Starting migrate sai...`))

  const {
    provider,
    contracts,
  } = context

  provider.pollingInterval = 500

  count = parseInt(count, 10)

  const users = await fetchUsers(count)

  for (let i = 0; i < count; i++) {
    const user = users[i].address
    const signer = provider.getSigner(user)
    const signingSai = contracts.PoolSaiToken.connect(signer)
    const balance = await signingSai.balanceOf(user)
    if (balance.gt('0x0')) {
      const startingPoolDaiBalance = await contracts.PoolDai.totalBalanceOf(user)
      console.log(chalk.dim(`Migrating ${ethers.utils.formatEther(balance)} for ${user} to PoolDai ${contracts.PoolDai.address}...`))
      await exec(provider, signingSai.send(contracts.PoolDai.address, balance, [], overrides))
      console.log(chalk.dim(`Migrated ${user}.`))
      const endingPoolDaiBalance = await contracts.PoolDai.totalBalanceOf(user)
      expect(endingPoolDaiBalance.sub(startingPoolDaiBalance).toString()).to.equal(balance.toString())
    } else {
      console.log(chalk.dim(`Skipping migrate for user ${user} who has no PoolSai`))
    }
  }

  console.log(chalk.green('Completed migrate sai.'))
}

module.exports = {
  migrateSai
}
