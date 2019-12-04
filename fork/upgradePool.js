#!/usr/bin/env node
const chai = require('chai')
const chalk = require('chalk')
const expect = chai.expect
const MultisigAbi = require('./GnosisMultisigAbi')
const { buildContext } = require('oz-console')

const {
  BINANCE_ADDRESS,
  MULTISIG,
  MULTISIG_ADMIN1,
  MULTISIG_ADMIN2,
  POOL_PROXY_ADDRESS,
  OLD_POOL_IMPLEMENTATION
} = require('./constants')

async function test (context) {
  const {
    provider,
    interfaces,
    contracts,
    loadNetworkConfig,
    ethers
  } = context

  provider.pollingInterval = 500

  expect(await contracts.ProxyAdmin.getProxyImplementation(POOL_PROXY_ADDRESS)).to.equal(OLD_POOL_IMPLEMENTATION)

  console.log('Balance of Binance: ', (await provider.getBalance(BINANCE_ADDRESS)).toString())

  // Binance 7 account.  Has *tons* of Ether
  let binance = provider.getSigner(BINANCE_ADDRESS)

  // Transfer eth to the admin so that we can deploy contracts
  let binTx = await binance.sendTransaction({ to: process.env.ADMIN_ADDRESS, value: ethers.utils.parseEther('100') })
  await provider.waitForTransaction(binTx.hash)

  let newNetworkConfig = loadNetworkConfig()
  const newPoolAddress = newNetworkConfig.contracts.PoolSai.address
  expect(newPoolAddress).to.not.equal(OLD_POOL_IMPLEMENTATION)

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
}

async function upgradePool() {
  console.log(chalk.yellow('Upgrading Pool...'))
  const context = buildContext({
    projectConfig: '.openzeppelin/project.json',
    network: process.env.LOCALHOST_URL,
    networkConfig: '.openzeppelin/mainnet.json',
    directory: 'build/contracts',
    verbose: false
  })

  await test(context)
  console.log(chalk.green("Upgraded."))
}

module.exports = {
  upgradePool
}
