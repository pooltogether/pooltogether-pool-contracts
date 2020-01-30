#!/usr/bin/env node
const { Project } = require('@pooltogether/oz-migrate')
const chalk = require('chalk')
const chai = require('chai')
const { runShell } = require('../fork/runShell')
const {
  MULTISIG_ADMIN1
} = require('../fork/helpers/constants')

async function migrate(context, ozNetworkName, ozOptions = '') {
  console.log(chalk.yellow('Starting migration...'))

  const project = new Project('.oz-migrate')
  const migration = await project.migrationForNetwork(ozNetworkName)

  let cSai
  if (ozNetworkName === 'rinkeby') {
    throw new Error('cSai not avilable on rinkeby')
  } else if (ozNetworkName === 'kovan') {
    cSai = '0x63c344bf8651222346dd870be254d4347c9359f7'
  } else { // assume mainnet
    cSai = '0xf5dce57282a584d2746faf1593d3121fcac444dc'
  }

  let cUsdc
  if (ozNetworkName === 'rinkeby') {
    throw new Error("cUsdc is avilable on rinkeby but don't use Rinkeby, use Kovan")
  } else if (ozNetworkName === 'kovan') {
    cUsdc = '0xcfc9bb230f00bffdb560fce2428b4e05f3442e35'
  } else { // assume mainnet
    cUsdc = '0x39aa39c021dfbae8fac545936693ac917d5e7563'
  }

  let cDai, scdMcdMigration
  if (ozNetworkName === 'rinkeby') {
    cDai = '0x6d7f0754ffeb405d23c51ce938289d4835be3b14'
  } else if (ozNetworkName === 'kovan') {
    cDai = '0xe7bc397dbd069fc7d0109c0636d06888bb50668c'
    scdMcdMigration = '0x411b2faa662c8e3e5cf8f01dfdae0aee482ca7b0'
  } else { //assume mainnet
    cDai = '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643'
    scdMcdMigration = '0xc73e0383f3aff3215e6f04b0331d58cecf0ab849'
  }

  let {
    walletAtIndex
  } = context

  const ownerWallet = await walletAtIndex(0)

  const feeFraction = '0'
  const lockDuration = 40
  const cooldownDuration = ozNetworkName === 'mainnet' ? lockDuration : 1

  runShell(`oz session ${ozOptions} --network ${ozNetworkName} --from ${process.env.ADMIN_ADDRESS} --expires 3600 --timeout 600`)

  let skip20 = false

  console.log(chalk.green('Starting SAI'))

  await migration.migrate(10, async () => {
    runShell(`oz create PoolSai --init init --args ${ownerWallet.address},${cSai},${feeFraction},${ownerWallet.address},${lockDuration},${cooldownDuration}`)
    context.reload()
    skip20 = true
  })

  if (!skip20) {
    await migration.migrate(20, () => {
      throw new Error('Pool must be manually upgraded using the Multisig.')
    })
  }

  await migration.migrate(30, async () => {
    runShell(`oz create PoolSaiToken ${ozOptions} --network ${ozNetworkName} --init init --args '"Pool Sai","plSai",[],${context.contracts.PoolSai.address}'`)
    context.reload()
  })

  await migration.migrate(39, async () => {
    chai.expect(await context.contracts.PoolSai.isAdmin(ownerWallet.address)).to.be.true
    // throw new Error('THIS FAILED...?')
    await context.contracts.PoolSai.setPoolToken(context.contracts.PoolSaiToken.address)
  })

  console.log(chalk.green('Starting DAI'))

  await migration.migrate(40, async () => {
    runShell(`oz create PoolDai ${ozOptions} --network ${ozNetworkName} --init init --args '${ownerWallet.address},${cDai},${feeFraction},${ownerWallet.address},${lockDuration},${cooldownDuration}'`)
    context.reload()
  })

  await migration.migrate(50, async () => {
    if (scdMcdMigration) {
      await context.contracts.PoolDai.initMigration(scdMcdMigration, context.contracts.PoolSai.address)
    }
  })

  await migration.migrate(55, async () => {
    runShell(`oz create PoolDaiToken ${ozOptions} --network ${ozNetworkName} --init init --args '"Pool Dai","plDai",[],${context.contracts.PoolDai.address}'`)
    context.reload()
  })

  await migration.migrate(56, async () => {
    console.log(chalk.yellow(`PoolDai#setPoolToken: ${context.contracts.PoolDaiToken.address}`))
    await context.contracts.PoolDai.setPoolToken(context.contracts.PoolDaiToken.address)
    console.log(chalk.green(`PoolDai#setPoolToken`))
  })

  await migration.migrate(60, async () => {
    console.log(chalk.yellow(`PoolDai#addAdmin: ${MULTISIG_ADMIN1}`))
    await context.contracts.PoolDai.addAdmin(MULTISIG_ADMIN1)
  })

  console.log(chalk.green('Starting USDC'))

  await migration.migrate(65, async () => {
    runShell(`oz create PoolUsdc ${ozOptions} --network ${ozNetworkName} --init init --args '${ownerWallet.address},${cUsdc},${feeFraction},${ownerWallet.address},${lockDuration},${cooldownDuration}'`)
    context.reload()
  })

  await migration.migrate(70, async () => {
    runShell(`oz create PoolUsdcToken ${ozOptions} --network ${ozNetworkName} --init init --args '"Pool Usdc","plUsdc",[],${context.contracts.PoolUsdc.address},6'`)
    context.reload()
  })

  await migration.migrate(75, async () => {
    console.log(chalk.yellow(`PoolUsdc#setPoolToken: ${context.contracts.PoolUsdcToken.address}`))
    await context.contracts.PoolUsdc.setPoolToken(context.contracts.PoolUsdcToken.address)
    console.log(chalk.green(`PoolUsdc#setPoolToken`))
  })

  await migration.migrate(80, async () => {
    console.log(chalk.yellow(`PoolUsdc#addAdmin: ${MULTISIG_ADMIN1}`))
    await context.contracts.PoolUsdc.addAdmin(MULTISIG_ADMIN1)
  })

  console.log(chalk.green('Done!'))
}

module.exports = {
  migrate
}
