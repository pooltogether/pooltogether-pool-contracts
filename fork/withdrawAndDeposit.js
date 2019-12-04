#!/usr/bin/env node
const assert = require('assert')
const chalk = require('chalk')
const loadUsers = require('./loadUsers')
const { buildContext } = require('oz-console')
const { exec } = require('./exec')

const {
  BINANCE_ADDRESS
} = require('./constants')

const overrides = {
  gasLimit: 2000000
}

async function test (context) {
  const {
    provider,
    artifacts,
    contracts,
    ethers,
  } = context

  provider.pollingInterval = 500

  const users = await loadUsers()

  // Binance 7 account.  Has *tons* of Ether
  let binance = provider.getSigner(BINANCE_ADDRESS)

  let withdrawalsCount = 5

  // Now ensure we can withdraw the top 5
  for (let i = 0; i < withdrawalsCount && i < users.length; i++) {
    let address = users[i].id
    let signer = provider.getSigner(address)
    let pool = new ethers.Contract(contracts.PoolSai.address, artifacts.Pool.abi, signer)
    // let address = users[i].id
    // Make sure they have enough ether
    console.log(chalk.green(`sending eth from ${BINANCE_ADDRESS} to ${address}...`))
    let binTx2 = await binance.sendTransaction({ to: address, value: ethers.utils.parseEther('1') })
    await provider.waitForTransaction(binTx2.hash)
    // let signer = provider.getSigner(address)
    // let pool = new ethers.Contract(contracts.PoolSai.address, artifacts.Pool.abi, signer)
    let openBalance = await pool.openBalanceOf(address)
    let committedBalance = await pool.committedBalanceOf(address)
    let balance = openBalance.add(committedBalance)

    if (balance.gt('0x0')) {
      console.log(chalk.yellow(`Withdrawing ${ethers.utils.formatEther(balance)} from ${address}...`))
      let tx = await pool.withdraw(overrides)
      await provider.waitForTransaction(tx.hash)
      console.log(chalk.green(`Withdrew ${ethers.utils.formatEther(balance)} from ${address}`))
    } else {
      console.log(chalk.red(`Cannot withdraw because ${address} has no balance`))
    }

    let cToken = new ethers.Contract(await pool.cToken(), artifacts.CErc20Mock.abi, provider)
    let token = new ethers.Contract(await cToken.underlying(), artifacts.ERC20.abi, signer)

    balance = await token.balanceOf(address)
    console.log(`Sai balance for ${address}: ${ethers.utils.formatEther(balance)}`)

    if (balance.gt('0x0')) {
      console.log(chalk.yellow(`Approving....`))
      exec(provider, await token.approve(pool.address, balance, overrides))

      console.log(chalk.yellow(`Depositing....`))
      exec(provider, await pool.depositPool(balance, overrides))

      let newSaiBalance = await token.balanceOf(address)
      console.log(`New Sai balance: ${ethers.utils.formatEther(newSaiBalance)}`)

      let poolBalance = await pool.openBalanceOf(address)
      assert.equal(poolBalance.toString(), balance.toString())

      console.log(chalk.green(`Deposit Successful. ${address} deposited ${balance}`))
    } else {
      console.log(chalk.dim(`User ${address} has no balance, skipping deposit`))
    }
  }
}

async function withdrawAndDeposit() {
  const context = buildContext({
    projectConfig: '.openzeppelin/project.json',
    network: process.env.LOCALHOST_URL,
    networkConfig: '.openzeppelin/mainnet.json',
    directory: 'build/contracts',
    verbose: false
  })

  await test(context)
}

module.exports = {
  withdrawAndDeposit
}