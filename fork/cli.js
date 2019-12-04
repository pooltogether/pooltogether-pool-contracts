#!/usr/bin/env node
const commander = require('commander');
const chalk = require('chalk')

const { showUsers } = require('./showUsers')
const { startFork } = require('./startFork')
const { transferToAdmin } = require('./transferToAdmin')
const { upgradePool } = require('./upgradePool')
const { pushContracts } = require('./pushContracts')
const { withdrawAndDeposit } = require('./withdrawAndDeposit')
const { reward } = require('./reward')

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
  .command('push')
  .description('pushes the latest contracts to the fork')
  .action(async () => {
    ranAction = true
    await pushContracts()
  })

program
  .command('pay')
  .description('transfers eth to the admin account on the fork')
  .action(async () => {
    ranAction = true
    await transferToAdmin()
  })

program
  .command('upgrade-v2x')
  .description('Executes the v2x migration')
  .action(async () => {
    ranAction = true
    await upgradePool()
  })

program
  .command('withdraw-deposit')
  .description('tests withdrawals and deposits for top 5 users')
  .action(async () => {
    ranAction = true
    await withdrawAndDeposit()
  })

program
  .command('list')
  .description('list the top 10 users')
  .action(async () => {
    ranAction = true
    await showUsers()
  })

program
  .command('reward')
  .description('reward and open the next draw')
  .action(async () => {
    ranAction = true
    await reward()
  })

program.parse(process.argv)

if (!ranAction) {
  console.log(chalk.red(`No command given.`))
  program.outputHelp()
  process.exit(1)
}