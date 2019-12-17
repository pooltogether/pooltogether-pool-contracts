#!/usr/bin/env node
const { Project } = require('oz-migrate')
const shell = require('shelljs')
const chalk = require('chalk')
const { buildContext } = require('oz-console')
const commander = require('commander');

function runShell(cmd) {
  console.log(chalk.dim(`$ ${cmd}`))
  const result = shell.exec(cmd)
  if (result.code !== 0) {
    throw new Error(`Could not run ${cmd}:`, result)
  }
}

const program = new commander.Command()
program.option('-n --network', 'select the network.')
program.option('-v --verbose', 'make all commands verbose', () => true)
program.option('-f --force', 'force the OpenZeppelin push command', () => true)
program.parse(process.argv)

let consoleNetwork, networkConfig, ozNetworkName

switch (program.network) {
  case 'mainnet':
    // The network that the oz-console app should talk to.  (should really just use the ozNetworkName)
    consoleNetwork = 'mainnet'

    // The OpenZeppelin SDK network name
    ozNetworkName = 'mainnet'

    // The OpenZeppelin SDK network config that oz-console should use as reference
    networkConfig = '.openzeppelin/mainnet.json'
    break
  case 'kovan':
    // The network that the oz-console app should talk to.  (should really just use the ozNetworkName)
    consoleNetwork = 'kovan'
    // The OpenZeppelin SDK network name
    ozNetworkName = 'kovan'
    // The OpenZeppelin SDK network config that oz-console should use as reference
    networkConfig = '.openzeppelin/kovan.json'
    break
  default: //rinkeby
    // The network that the oz-console app should talk to.  (should really just use the ozNetworkName)
    consoleNetwork = 'rinkeby'

    // The OpenZeppelin SDK network name
    ozNetworkName = 'rinkeby'

    // The OpenZeppelin SDK network config that oz-console should use as reference
    networkConfig = '.openzeppelin/rinkeby.json'
    break
}

console.log(chalk.green(`Selected network is ${ozNetworkName}`))

let forceOption = program.force ? '--force' : ''

function loadContext() {
  return buildContext({
    projectConfig: '.openzeppelin/project.json',
    network: consoleNetwork,
    networkConfig,
    directory: 'build/contracts',
    verbose: false,
    mnemonic: process.env.HDWALLET_MNEMONIC
  })
}

const ozOptions = program.verbose ? '' : '-s'

async function migrate() {
  console.log(chalk.yellow('Starting migration...'))

  const project = new Project('.oz-migrate')
  const migration = await project.migrationForNetwork(ozNetworkName)

  runShell(`oz compile ${ozOptions}`)

  runShell(`oz session ${ozOptions} --network ${ozNetworkName} --from ${process.env.ADMIN_ADDRESS} --expires 3600 --timeout 600`)

  let context = loadContext()

  let {
    walletAtIndex
  } = context

  const owner = await walletAtIndex(0)

  await migration.migrate(10, () => {
    let cSai
    if (ozNetworkName === 'rinkeby') {
      cSai = '0x6d7f0754ffeb405d23c51ce938289d4835be3b14'
    } else if (ozNetworkName === 'kovan') {
      cSai = '0x63c344bf8651222346dd870be254d4347c9359f7'
    } else if (ozNetworkName === 'mainnet') {
      cSai = '0xf5dce57282a584d2746faf1593d3121fcac444dc'
    }
    const feeFraction = web3.utils.toWei('0.1', 'ether')
    runShell(`oz create PoolSai --init init --args ${owner},${cSai},${feeFraction},${owner}`)
    context = loadContext()
  })

  await migration.migrate(20, () => {
    let cDai, scdMcdMigration
    if (ozNetworkName === 'rinkeby') {
      cDai = '0x6d7f0754ffeb405d23c51ce938289d4835be3b14'
    } else if (ozNetworkName === 'kovan') {
      cDai = '0x63c344bf8651222346dd870be254d4347c9359f7'
      scdMcdMigration = '0x411b2faa662c8e3e5cf8f01dfdae0aee482ca7b0'
    } else if (ozNetworkName === 'mainnet') {
      cDai = '0xf5dce57282a584d2746faf1593d3121fcac444dc'
      scdMcdMigration = '0xc73e0383f3aff3215e6f04b0331d58cecf0ab849'
    }
    const feeFraction = web3.utils.toWei('0.1', 'ether')
    runShell(`oz create PoolDai --init init --args ${owner},${cDai},${feeFraction},${owner}`)
    context = loadContext()

    if (scdMcdMigration) {
      poolDai = context.contracts.PoolDai.connect(owner)
      poolDai.initMigration(scdMcdMigration, context.contracts.PoolSai.address)
    }
  })

  console.log(chalk.green('Done!'))
}

migrate().catch(error => {
  console.error(`Could not migrate: ${error.message}`, error)
})
