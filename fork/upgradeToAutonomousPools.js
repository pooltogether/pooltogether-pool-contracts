#!/usr/bin/env node
const chai = require('chai')
const chalk = require('chalk')
const expect = chai.expect
const MultisigAbi = require('./GnosisMultisigAbi')
const { runShell } = require('./runShell')

const {
  POOL_ADMIN,
  SAFE_ADDRESS,
  MULTISIG,
  MULTISIG_ADMIN1,
  MULTISIG_ADMIN2
} = require('./helpers/constants')

async function upgradeToAutonomousPools (context) {
  console.log(chalk.yellow('Upgrading all pools to AutonomousPool...'))
  const {
    provider,
    interfaces,
    contracts,
    loadNetworkConfig,
    ethers
  } = context

  provider.pollingInterval = 500

  // Expect the user to have pushed the contracts
  let networkConfig = loadNetworkConfig()

  const autonomousPoolImpl = networkConfig.contracts.AutonomousPool.address
  console.log(chalk.dim(`AutonomousPool address: ${autonomousPoolImpl}`))

  const poolSai = networkConfig.proxies['pooltogether/PoolSai']
  const poolDai = networkConfig.proxies['pooltogether/PoolDai']
  const poolUsdc = networkConfig.proxies['pooltogether/PoolUsdc']

  const multisigSigner1 = provider.getSigner(MULTISIG_ADMIN1)
  const multisigSigner2 = provider.getSigner(MULTISIG_ADMIN2)

  const poolAdminSigner = provider.getSigner(POOL_ADMIN)

  const ms1 = new ethers.Contract(MULTISIG, MultisigAbi, multisigSigner1)
  const ms2 = new ethers.Contract(MULTISIG, MultisigAbi, multisigSigner2)

  const comptroller = '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b'
  const comp = '0xc00e94cb662c3520282e6f5717214004a7f26888'

  async function upgrade(proxyAddress, initializeAutonomousPoolParams) {
    const currentProxy = await contracts.ProxyAdmin.getProxyImplementation(proxyAddress)

    if (currentProxy.toLowerCase() != autonomousPoolImpl.toLowerCase()) {
      console.log(chalk.yellow(`Upgrading ${proxyAddress} from ${currentProxy} to AutonomousPool ${autonomousPoolImpl} with ProxyAdmin ${contracts.ProxyAdmin.address}`))
      const initializeAutonomousPoolData = interfaces.AutonomousPool.functions.initializeAutonomousPool.encode(initializeAutonomousPoolParams)
      const upgradeAndCallData = interfaces.ProxyAdmin.functions.upgradeAndCall.encode([proxyAddress, autonomousPoolImpl, initializeAutonomousPoolData])

      const txCount = parseInt((await ms1.transactionCount()).toString())
      console.log(chalk.dim(`Current multisg tx count: ${txCount}`))

      console.log(chalk.dim(`First multisig signer creating tx...`))

      // first signer creates tx
      const submitTx = await ms1.submitTransaction(contracts.ProxyAdmin.address, 0, upgradeAndCallData, { gasLimit: 8000000 })
      await provider.waitForTransaction(submitTx.hash)
      const submitTxReceipt = await provider.getTransactionReceipt(submitTx.hash)
      // console.log({submitTxReceipt})

      const lastTxId = parseInt((await ms1.transactionCount()).toString())

      console.log(chalk.dim(`Second multisig signer confirming tx ${lastTxId}...`))

      // have the second signer confirm
      const confirmTx = await ms2.confirmTransaction(lastTxId-1, { gasLimit: 9000000 })
      await provider.waitForTransaction(confirmTx.hash)
      const confirmTxReceipt = await provider.getTransactionReceipt(confirmTx.hash)
      const events = confirmTxReceipt.logs.map(log => { try { return ms2.interface.parseLog(log) } catch (e) { return null } })
      // console.log({confirmTxReceipt})
      // console.log({events})

      // The contract is now upgraded
      expect(await contracts.ProxyAdmin.getProxyImplementation(proxyAddress)).to.equal(autonomousPoolImpl)
    } else {
      console.log(chalk.cyan("Already upgraded!"))
    }

    return new ethers.Contract(proxyAddress, interfaces.AutonomousPool.abi, poolAdminSigner)
  }

  const oneWeek = 604800

  console.log(chalk.yellow(`Upgrading Sai Pool...`))
  const saiPool = await upgrade(poolSai[0].address, [oneWeek, comp, comptroller])
  await saiPool.setCompRecipient(SAFE_ADDRESS)
  console.log(chalk.green(`Upgraded!`))

  console.log(chalk.yellow(`Upgrading Dai Pool...`))
  const daiPool = await upgrade(poolDai[0].address, [oneWeek, comp, comptroller])
  await daiPool.setCompRecipient(SAFE_ADDRESS)
  console.log(chalk.green(`Upgraded!`))

  const oneDay = 3600 * 24
  console.log(chalk.yellow(`Upgrading USDC Pool...`))
  const usdcPool = await upgrade(poolUsdc[0].address, [oneDay, comp, comptroller])
  await usdcPool.setCompRecipient(SAFE_ADDRESS)
  console.log(chalk.green(`Upgraded!`))

  runShell(`echo 20 > .oz-migrate/mainnet_fork`)

  console.log(chalk.green("Upgraded to AutonomousPools"))
}

module.exports = {
  upgradeToAutonomousPools
}
