#!/usr/bin/env node
const assert = require('assert')
const chalk = require('chalk')
const { fetchUsers } = require('./fetchUsers')
const { exec } = require('./exec')
const ethers = require('ethers')

const overrides = {
  gasLimit: ethers.utils.bigNumberify("2000000")
}

async function withdrawAndDeposit (context, type, count = '5') {
  console.log(chalk.yellow(`Starting withdraw and deposit for ${type} pool...`))

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

  const users = await fetchUsers(parseInt(count, 10))

  // Now ensure we can withdraw the top 5
  for (let i = 0; i < users.length; i++) {
    let address = users[i].address
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

    let cToken = new ethers.Contract(await signingPool.cToken(), artifacts.CErc20Mock.abi, provider)
    let token = new ethers.Contract(await cToken.underlying(), artifacts.ERC20.abi, signer)

    balance = await token.balanceOf(address)

    if (balance.gt('0x0')) {
      console.log(chalk.yellow(`Approving ${ethers.utils.formatEther(balance)} ${type}....`))
      await exec(provider, token.approve(signingPool.address, balance, overrides))

      console.log(chalk.yellow(`Depositing ${ethers.utils.formatEther(balance)} ${type}....`))
      await exec(provider, signingPool.depositPool(balance, overrides))

      let poolBalance = await signingPool.openBalanceOf(address)
      assert.equal(poolBalance.toString(), balance.toString())

      console.log(chalk.green(`Deposit Successful. ${address} deposited ${ethers.utils.formatEther(balance)}`))
    } else {
      console.log(chalk.dim(`User ${address} has no ${type} balance, skipping deposit`))
    }
  }

  console.log(chalk.green('Completed withdraw and deposit.'))
}

module.exports = {
  withdrawAndDeposit
}