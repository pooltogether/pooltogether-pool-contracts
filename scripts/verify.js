#!/usr/bin/env node
const chalk = require('chalk')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const buidler = require('@nomiclabs/buidler')

const info = (msg) => console.log(chalk.dim(msg))
const success = (msg) => console.log(chalk.green(msg))
const error = (msg) => console.error(chalk.red(msg))

const getContract = async (name) => {
  const { deployments } = buidler
  const signers = await buidler.ethers.getSigners()
  return buidler.ethers.getContractAt(name, (await deployments.get(name)).address, signers[0])
}

const verifyAddress = async (address, name, options = "") => {
  const network = await buidler.ethers.provider.getNetwork()
  try {
    await exec(`buidler ${options} verify --network ${network.name} ${address}`)
  } catch (e) {
    if (/Contract source code already verified/.test(e.message)) {
      info(`${name} already verified`)
    } else {
      error(e.message)
      console.error(e)
    }
  }
}

const verifyProxyFactory = async (name) => {
  const proxyFactory = await getContract(name)
  const instanceAddress = await proxyFactory.instance()
  info(`Verifying ${name} instance...`)
  await verifyAddress(instanceAddress, name)
  success(`Verified!`)
}

const verifyContract = async (name, options = "") => {
  info(`Verifying ${name}...`)
  const address = (await deployments.get(name)).address
  await verifyAddress(address, name, options)
  success(`Verified!`)
}

async function run() {
  const network = await buidler.ethers.provider.getNetwork()

  info(`Verifying top-level contracts...`)
  const { stdout, stderr } = await exec(
    `buidler etherscan-verify --solc-input --api-key $ETHERSCAN_API_KEY --network ${network.name}`
  )
  console.log(chalk.yellow(stdout))
  console.log(chalk.red(stderr))
  info(`Done top-level contracts`)

  info(`Verifying proxy factory instances...`)

  await verifyProxyFactory('CompoundPrizePoolProxyFactory')
  await verifyProxyFactory('ControlledTokenProxyFactory')
  await verifyProxyFactory('MultipleWinnersProxyFactory')
  await verifyProxyFactory('SingleRandomWinnerProxyFactory')
  await verifyProxyFactory('StakePrizePoolProxyFactory')
  await verifyProxyFactory('TicketProxyFactory')
  await verifyProxyFactory('yVaultPrizePoolProxyFactory')

  success('Done!')
}

run()
