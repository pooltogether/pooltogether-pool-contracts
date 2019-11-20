#!/usr/bin/env node
const chalk = require('chalk')
const loadUsers = require('./loadUsers')
const { buildContext } = require('oz-console')

const {
  BINANCE_ADDRESS,
} = require('./constants')

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

  let withdrawalsCount = 1
  let userBalances = {}

  // Now ensure we can withdraw the top 5
  for (let i = 0; i < withdrawalsCount; i++) {
    let address = users[i].id
    // Make sure they have enough ether
    let binTx2 = await binance.sendTransaction({ to: address, value: ethers.utils.parseEther('1') })
    await provider.waitForTransaction(binTx2.hash)
    let signer = provider.getSigner(address)
    let pool = new ethers.Contract(contracts.Pool.address, artifacts.Pool.abi, signer)
    userBalances[address] = await pool.balanceOf(address)
    let balance = ethers.utils.formatEther(userBalances[address])
    console.log(chalk.green(`Withdrawal ${i}: ${address} is withdrawing ${balance}`))
    let tx = await pool.withdraw()
    await provider.waitForTransaction(tx.hash)
  }

  // now deposit again
  for (let i = 0; i < withdrawalsCount; i++) {
    let address = users[i].id
    // Make sure they have enough ether
    let signer = provider.getSigner(address)
    let pool = new ethers.Contract(contracts.Pool.address, artifacts.Pool.abi, signer)
    let token = new ethers.Contract(await pool.token(), artifacts.ERC20.abi, signer)
    let balance = userBalances[address]
    console.log(chalk.green(`Depositing ${i}: ${address} is depositing ${balance}`))

    console.log(`user balance: ${ethers.utils.formatEther(await token.balanceOf(address))}`)

    // let tx = await token.approve(pool.address, balance)
    // await provider.waitForTransaction(tx.hash)

    tx = await pool.depositPool(balance)
    await provider.waitForTransaction(tx.hash)
  }
}

async function run() {
  const context = buildContext({
    projectConfig: '.openzeppelin/project.json',
    network: process.env.LOCALHOST_URL,
    networkConfig: '.openzeppelin/mainnet.json',
    directory: 'build/contracts',
    verbose: false
  })

  await test(context)
}

run().then(() => {
  console.log("Done.")
})
