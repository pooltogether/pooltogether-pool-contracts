#!/usr/bin/env node
const commander = require('commander');
const chalk = require('chalk')
const { showUsers } = require('./showUsers')
const { startFork } = require('./startFork')
const { pay } = require('./pay')
const { upgradePool } = require('./upgradePool')
const { pushContracts } = require('./pushContracts')
const { withdrawAndDeposit } = require('./withdrawAndDeposit')
const { reward } = require('./reward')
const { deployPoolDai } = require('./deployPoolDai')
const { mint } = require('./mint')
const { migrateSai } = require('./migrateSai')
const { poolBalances } = require('./poolBalances')
const { context } = require('./context')

const program = new commander.Command()
program.description('Handles fork scripting.  Start a mainnet fork then run scripts against it.')
program.option('-v --verbose', 'make all commands verbose', () => true)
program.option('-f --force', 'force the OpenZeppelin push command', () => true)

let ranAction = false

program
  .command('start')
  .description('Starts a local node that is forked from mainnet.  Available on http://localhost:8546')
  .action(async () => {
    ranAction = true
    await startFork()
  })

program
  .command('pay')
  .description('transfers eth to the admin account on the fork')
  .action(async () => {
    ranAction = true
    await pay(await context())
  })

program
  .command('push')
  .description('pushes the latest contracts to the fork')
  .action(async () => {
    ranAction = true
    pushContracts()
  })

program
  .command('upgrade-v2x')
  .description('Executes the v2x migration')
  .action(async () => {
    ranAction = true
    await upgradePool(await context())
  })

program
  .command('deploy-dai')
  .description('deploys the McDai Pool')
  .action(async () => {
    ranAction = true
    await deployPoolDai(await context())
  })

program
  .command('reward [type] [count]')
  .description('reward and open the next draw [count] times. Type is one of sai | dai.  Defaults to sai')
  .action(async (type, count) => {
    ranAction = true
    if (!type) {
      type = 'sai'
    }
    if (!count) {
      count = 1
    }
    const c = await context()
    for (let i = 0; i < count; i++) {
      await reward(c, type)
    }
  })

program
  .command('withdraw-deposit [type] Type is one of sai | dai.  Defaults to sai')
  .description('tests withdrawals and deposits for top 5 users')
  .action(async (type) => {
    ranAction = true
    if (!type) {
      type = 'sai'
    }
    await withdrawAndDeposit(await context(), type)
  })

program
  .command('list')
  .description('list the top 10 users')
  .action(async () => {
    ranAction = true
    await showUsers()
  })

program
  .command('mint [type]')
  .description('transfers dai to the top 10 users.  Type is one of sai | dai.  Defaults to sai')
  .action(async (type) => {
    ranAction = true
    if (!type) {
      type = 'sai'
    }
    await mint(await context(), type)
  })

program
  .command('migrate-sai')
  .description('migrates PoolSai for the top 10 users.')
  .action(async () => {
    ranAction = true
    await migrateSai(await context())
  })

program
  .command('balances [type]')
  .description('Displays Pool balances for the top 10 users.   Type is one of sai | dai.  Defaults to sai')
  .action(async (type) => {
    ranAction = true
    if (!type) {
      type = 'sai'
    }
    await poolBalances(await context(), type)
  })

program.parse(process.argv)

if (!ranAction) {
  console.log(chalk.red(`No command given.`))
  program.outputHelp()
  process.exit(1)
}