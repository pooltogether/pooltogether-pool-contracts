#!/usr/bin/env node
const chai = require('chai')
const chalk = require('chalk')
const expect = chai.expect
const shell = require('shelljs')
const MultisigAbi = require('./GnosisMultisigAbi')
const { buildContext } = require('oz-console')

const {
  BINANCE_ADDRESS,
  DEPLOY_ADMIN,
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
    networkConfig,
    ethers,
    loadNetworkConfig
  } = context

  provider.pollingInterval = 500

  expect(networkConfig.proxies["pooltogether/Pool"][0].implementation).to.equal(OLD_POOL_IMPLEMENTATION)

  console.log('Balance of Binance: ', (await provider.getBalance(BINANCE_ADDRESS)).toString())

  // Binance 7 account.  Has *tons* of Ether
  let binance = provider.getSigner(BINANCE_ADDRESS)

  // Transfer eth to the admin so that we can deploy contracts
  let binTx = await binance.sendTransaction({ to: DEPLOY_ADMIN, value: ethers.utils.parseEther('100') })
  await provider.waitForTransaction(binTx.hash)

  // Deploy the new contracts
  const response = shell.exec(`INFURA_PROVIDER_URL_MAINNET=${process.env.LOCALHOST_URL} oz push --network mainnet --force --from ${DEPLOY_ADMIN}`)
  if (response.code !== 0) {
    throw new Error('Unable to push contracts: ', response)
  }

  let newNetworkConfig = loadNetworkConfig()
  const newPoolAddress = newNetworkConfig.contracts.Pool.address
  expect(newPoolAddress).to.not.equal(OLD_POOL_IMPLEMENTATION)

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
  // The contract is now upgraded

  // Check that the upgrade was successful
  expect(await contracts.ProxyAdmin.getProxyImplementation(POOL_PROXY_ADDRESS)).to.equal(newPoolAddress)
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

console.log(chalk.green('Upgrading Pool to MCDAwarePool'))
run().then(() => {
  console.log(chalk.green("Upgraded."))
})
