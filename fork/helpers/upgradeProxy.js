const chai = require('chai')
const chalk = require('chalk')
const expect = chai.expect
const MultisigAbi = require('../GnosisMultisigAbi')

const {
  MULTISIG,
  MULTISIG_ADMIN1,
  MULTISIG_ADMIN2
} = require('./constants')

const overrides = {
  gasLimit: 5000000
}

async function upgradeProxy(context, proxyAddress, implementationAddress, postUpgradeCallData) {
  const {
    provider,
    interfaces,
    contracts,
    ethers
  } = context

  let multisigSigner1 = provider.getSigner(MULTISIG_ADMIN1)
  let multisigSigner2 = provider.getSigner(MULTISIG_ADMIN2)

  const ms1 = new ethers.Contract(MULTISIG, MultisigAbi, multisigSigner1)
  const ms2 = new ethers.Contract(MULTISIG, MultisigAbi, multisigSigner2)

  let upgradeData
  if (postUpgradeCallData) {
    upgradeData = interfaces.ProxyAdmin.functions.upgradeAndCall.encode([proxyAddress, implementationAddress. postUpgradeCallData])
  } else {
    upgradeData = interfaces.ProxyAdmin.functions.upgrade.encode([proxyAddress, implementationAddress])
  }

  console.log(chalk.yellow(`Submitting first multisig tx from ${multisigSigner1._address}....`))
  await ms1.submitTransaction(contracts.ProxyAdmin.address, 0, upgradeData, overrides)
  const lastTxId = parseInt((await ms1.transactionCount()).toString())
  // have the second signer confirm
  console.log(chalk.yellow(`Confirming multisig tx from ${multisigSigner2._address}....`))
  const confirmTx = await ms2.confirmTransaction(lastTxId-1, overrides)
  receipt = await provider.waitForTransaction(confirmTx.hash)

  // The contract is now upgraded
  expect(await contracts.ProxyAdmin.getProxyImplementation(proxyAddress)).to.equal(implementationAddress)
}

module.exports = {
  upgradeProxy
}