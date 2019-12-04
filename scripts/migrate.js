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
program.option('-m --mainnet', 'run the migrations against mainnet', () => true)
program.option('-v --verbose', 'make all commands verbose', () => true)
program.option('-f --force', 'force the OpenZeppelin push command', () => true)
program.parse(process.argv)

let consoleNetwork, networkConfig, ozNetworkName

if (program.mainnet) {
  console.log(chalk.green('Selected network is mainnet'))
  // The network that the oz-console app should talk to.  (should really just use the ozNetworkName)
  consoleNetwork = 'mainnet'

  // The OpenZeppelin SDK network name
  ozNetworkName = 'mainnet'

  // The OpenZeppelin SDK network config that oz-console should use as reference
  networkConfig = '.openzeppelin/mainnet.json'
} else {
  console.log(chalk.green('Selected network is rinkeby'))
  // The network that the oz-console app should talk to.  (should really just use the ozNetworkName)
  consoleNetwork = 'rinkeby'

  // The OpenZeppelin SDK network name
  ozNetworkName = 'rinkeby'

  // The OpenZeppelin SDK network config that oz-console should use as reference
  networkConfig = '.openzeppelin/rinkeby.json'
}

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
    // Compound DAI token on Rinkeby
    if (oNetworkName === 'rinkeby') {
      // See https://compound.finance/developers#getting-started
      // and https://rinkeby.etherscan.io/address/0x6d7f0754ffeb405d23c51ce938289d4835be3b14
      cSai = '0x6d7f0754ffeb405d23c51ce938289d4835be3b14'
    } else if (oNetworkName === 'mainnet') {
      cSai = '0xf5dce57282a584d2746faf1593d3121fcac444dc'
    }

    const feeFraction = web3.utils.toWei('0.1', 'ether')

    runShell(`oz create Pool --init init --args ${owner},${cSai},${feeFraction},${owner}`)
    context = loadContext()
  })

  await migration.migrate(20, () => {
    // deploy upgraded pool contract
    runShell(`oz push ${ozOptions} ${forceOption}`)
    context = loadContext()
  })

}

console.log(chalk.yellow('Started...'))
migrate().then(() =>{
  console.log(chalk.green('Done!'))
}).catch(error => {
  console.error(`Could not migrate: ${error.message}`, error)
})
