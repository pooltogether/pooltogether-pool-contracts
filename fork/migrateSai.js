#!/usr/bin/env node
const chalk = require('chalk')
const { fetchUsers } = require('./fetchUsers')
const { exec } = require('./exec')
const { ethers } = require('ethers')

const overrides = {
  gasLimit: 5000000
}

async function migrateSai (context) {
  console.log(chalk.yellow(`Starting migrate sai...`))

  const {
    provider,
    contracts,
  } = context

  provider.pollingInterval = 500

  const users = await fetchUsers()

  // for (let i = 0; i < 5; i++) {
    // const user = users[i].id
    const user = users[0].id
    const signer = provider.getSigner(user)
    const signingSai = contracts.PoolSai.connect(signer)
    const balance = await signingSai.balanceOf(user)
    if (balance.gt('0x0')) {
      const startingPoolDaiBalance = await contracts.PoolDai.balanceOf(user)
      console.log(chalk.dim(`Migrating ${ethers.utils.formatEther(balance)} for ${user} to PoolDai ${contracts.PoolDai.address}...`))
      await exec(provider, signingSai.transfer(contracts.PoolDai.address, balance, overrides))
      console.log(chalk.dim(`Migrated ${user}.`))
      const endingPoolDaiBalance = await contracts.PoolDai.balanceOf(user)
      expect(endingPoolDaiBalance.sub(startingPoolDaiBalance)).to.equal(balance.toString())
    } else {
      console.log(chalk.dim(`Skipping migrate for user ${user} who has no PoolSai`))
    }
  // }

  console.log(chalk.green('Completed migrate sai.'))
}

module.exports = {
  migrateSai
}