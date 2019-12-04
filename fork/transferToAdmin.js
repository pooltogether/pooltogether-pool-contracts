#!/usr/bin/env node
const chai = require('chai')
const expect = chai.expect
const chalk = require('chalk')
const { buildContext } = require('oz-console')

const {
  BINANCE_ADDRESS
} = require('./constants')

async function test (context) {
  const {
    provider,
    ethers
  } = context

  // Binance 7 account.  Has *tons* of Ether
  let binance = provider.getSigner(BINANCE_ADDRESS)

  // Transfer eth to the admin so that we can deploy contracts
  let binTx = await binance.sendTransaction({ to: process.env.ADMIN_ADDRESS, value: ethers.utils.parseEther('100') })
  await provider.waitForTransaction(binTx.hash)
  let result = await provider.getTransactionReceipt(binTx.hash)
  expect(result.status).to.equal(1)
}

async function transferToAdmin() {
  const context = buildContext({
    projectConfig: '.openzeppelin/project.json',
    network: process.env.LOCALHOST_URL,
    networkConfig: '.openzeppelin/mainnet.json',
    directory: 'build/contracts',
    verbose: false
  })

  await test(context)

  console.log(chalk.green(`ProxyAdmin ${process.env.ADMIN_ADDRESS} received 100 ether`))
}

module.exports = {
  transferToAdmin
}