#!/usr/bin/env node
const chai = require('chai')
const chalk = require('chalk')
const expect = chai.expect
const MultisigAbi = require('./GnosisMultisigAbi')

const {
  BINANCE_ADDRESS,
  MULTISIG,
  MULTISIG_ADMIN1,
  MULTISIG_ADMIN2,
  POOL_PROXY_ADDRESS,
  OLD_POOL_IMPLEMENTATION
} = require('./constants')

async function upgradePool (context) {
  console.log(chalk.yellow('Upgrading Pool...'))
  const {
    provider,
    interfaces,
    contracts,
    loadNetworkConfig,
    ethers
  } = context

  provider.pollingInterval = 500

  expect(await contracts.ProxyAdmin.getProxyImplementation(POOL_PROXY_ADDRESS)).to.equal(OLD_POOL_IMPLEMENTATION)

  // Expect the user to have pushed the contracts
  let newNetworkConfig = loadNetworkConfig()
  const newPoolAddress = newNetworkConfig.contracts.PoolSai.address
  try {
    expect(newPoolAddress).to.not.equal(OLD_POOL_IMPLEMENTATION)
  } catch (e) {
    console.log(chalk.red(`Make sure to run 'yarn fork push' first`))
    throw e
  }

  // const newPoolAddress = contracts.PoolSai.address
  // expect(newPoolAddress).to.not.equal(OLD_POOL_IMPLEMENTATION)

  let multisigSigner1 = provider.getSigner(MULTISIG_ADMIN1)
  let multisigSigner2 = provider.getSigner(MULTISIG_ADMIN2)

  const ms1 = new ethers.Contract(MULTISIG, MultisigAbi, multisigSigner1)
  const ms2 = new ethers.Contract(MULTISIG, MultisigAbi, multisigSigner2)

  const initBasePoolUpgradeData = interfaces.Pool.functions.initBasePoolUpgrade.encode(['Pool Sai', 'plSAI', []])
  const upgradeAndCallData = interfaces.ProxyAdmin.functions.upgradeAndCall.encode([POOL_PROXY_ADDRESS, newPoolAddress, initBasePoolUpgradeData])

  const submitTx = await ms1.submitTransaction(contracts.ProxyAdmin.address, 0, upgradeAndCallData)
  await provider.waitForTransaction(submitTx.hash)

  const lastTxId = parseInt((await ms1.transactionCount()).toString())

  // have the second signer confirm
  const confirmTx = await ms2.confirmTransaction(lastTxId-1, { gasLimit: 800000 })
  await provider.waitForTransaction(confirmTx.hash)
  confirmTx.hash
  // The contract is now upgraded

  // Check that the upgrade was successful
  expect(await contracts.ProxyAdmin.getProxyImplementation(POOL_PROXY_ADDRESS)).to.equal(newPoolAddress)

  console.log(chalk.green("Upgraded."))
}

module.exports = {
  upgradePool
}
