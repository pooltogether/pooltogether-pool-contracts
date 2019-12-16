#!/usr/bin/env node
const chai = require('chai')
const chalk = require('chalk')
const expect = chai.expect
const MultisigAbi = require('./GnosisMultisigAbi')

const {
  MULTISIG,
  MULTISIG_ADMIN1,
  MULTISIG_ADMIN2,
  POOL_PROXY_ADDRESS
} = require('./constants')

const overrides = {
  gasLimit: 7000000
}

async function upgrade (context) {
  console.log(chalk.yellow('Upgrading Pool...'))
  const {
    provider,
    interfaces,
    contracts,
    loadNetworkConfig,
    ethers
  } = context

  provider.pollingInterval = 500

  // Expect the user to have pushed the contracts
  let newNetworkConfig = loadNetworkConfig()
  const newPoolAddress = newNetworkConfig.contracts.PoolSai.address

  let multisigSigner1 = provider.getSigner(MULTISIG_ADMIN1)
  let multisigSigner2 = provider.getSigner(MULTISIG_ADMIN2)

  const ms1 = new ethers.Contract(MULTISIG, MultisigAbi, multisigSigner1)
  const ms2 = new ethers.Contract(MULTISIG, MultisigAbi, multisigSigner2)

  console.log(chalk.yellow(`Upgrading to ${newPoolAddress}...`))

  const upgradeData = interfaces.ProxyAdmin.functions.upgrade.encode([POOL_PROXY_ADDRESS, newPoolAddress])

  const prevTxCount = await ms1.transactionCount()

  console.log('prev count: ', prevTxCount.toString())

  const submitTx = await ms1.submitTransaction(contracts.ProxyAdmin.address, 0, upgradeData, overrides)
  let receipt = await provider.waitForTransaction(submitTx.hash)
  // console.log(receipt)

  const lastTxId = parseInt((await ms1.transactionCount()).toString())

  console.log('new count: ', lastTxId.toString())

  // have the second signer confirm
  const confirmTx = await ms2.confirmTransaction(lastTxId-1, overrides)
  receipt = await provider.waitForTransaction(confirmTx.hash)
  // console.log(receipt)

  // The contract is now upgraded
  expect(await contracts.ProxyAdmin.getProxyImplementation(POOL_PROXY_ADDRESS)).to.equal(newPoolAddress)

  console.log(chalk.green("Upgraded."))
}

module.exports = {
  upgrade
}
