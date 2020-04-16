#!/usr/bin/env node
const commander = require('commander');
const chalk = require('chalk')
const { showUsers } = require('./showUsers')
const { startFork } = require('./startFork')
const { pay } = require('./pay')
const { upgradeV2x } = require('./upgradeV2x')
const { upgrade } = require('./upgrade')
const { pushContracts } = require('./pushContracts')
const { withdrawAndDeposit } = require('./withdrawAndDeposit')
const { rewardAndOpen } = require('./rewardAndOpen')
const { openNextDraw } = require('./openNextDraw')
const { reward } = require('./reward')
// const { deployPoolDai } = require('./deployPoolDai')
const { migrateScript } = require('./migrateScript')
const { mint } = require('./mint')
const { migrateSai } = require('./migrateSai')
const { poolBalances } = require('./poolBalances')
const { swapSaiToDai } = require('./swapSaiToDai')
const { calculateWinners } = require('./calculateWinners')
const { wards } = require('./wards')
const { trace } = require('./trace')
const { context } = require('./context')
const { rollover } = require('./rollover')
const { transfer } = require('./transfer')
const { burn } = require('./burn')
const { transferDai } = require('./transferDai')

const program = new commander.Command()
program.description('Handles fork scripting.  Start a mainnet fork then run scripts against it.')
program.option('-v --verbose', 'make all commands verbose', () => true)
program.option('-f --force', 'force the OpenZeppelin push command', () => true)
program.option('-m --mainnet', 'use mainnet')

let ranAction = false

async function callContext() {
  return await context(program.verbose, program.mainnet)
}

program
  .command('start')
  .description('Starts a local node that is forked from mainnet.  Available on http://localhost:8546.  Copies .openzeppelin/mainnet.json to .openzeppelin/dev-999.json')
  .action(async () => {
    ranAction = true
    await startFork()
  })

program
  .command('pay [count]')
  .description('transfers eth to the admin account on the fork.')
  .action(async (count) => {
    ranAction = true
    if (!count) {
      count = '5'
    }
    await pay(await callContext(), count)
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
  .description('Upgrades the Pool contract')
  .action(async () => {
    ranAction = true
    await upgradeV2x(await callContext())
  })

program
  .command('upgrade')
  .description('Upgrade all contracts with the new deployed versions.  Should have pushed already.')
  .action(async () => {
    ranAction = true
    await upgrade(await callContext())
  })

program
  .command('migrate')
  .description('runs the migrate script')
  .action(async () => {
    ranAction = true
    await migrateScript(await callContext())
  })

// program
//   .command('deploy-dai')
//   .description('deploys the McDai Pool')
//   .action(async () => {
//     ranAction = true
//     await deployPoolDai(await callContext())
//   })

program
  .command('reward-open [type] [count]')
  .description('reward and open the next draw [count] times. Type is one of sai | dai.  Defaults to sai')
  .action(async (type, count) => {
    ranAction = true
    if (!type) {
      type = 'sai'
    }
    if (!count) {
      count = 1
    }
    const c = await callContext()
    for (let i = 0; i < count; i++) {
      await rewardAndOpen(c, type)
    }
  })

program
  .command('transfer-dai [recipient] [amount]')
  .description('Transfer [amount] dai to [recipient]')
  .action(async (recipient, amount) => {
    ranAction = true
    if (!amount) {
      amount = 10
    }
    const c = await callContext()
    await transferDai(c, recipient, amount)
  })

program
  .command('reward [type]')
  .description('reward the next draw. Type is one of sai | dai.  Defaults to sai')
  .action(async (type) => {
    ranAction = true
    if (!type) {
      type = 'sai'
    }
    const c = await callContext()
    await reward(c, type)
  })

program
  .command('open [type]')
  .description('open the next draw. Type is one of sai | dai.  Defaults to sai')
  .action(async (type) => {
    ranAction = true
    if (!type) {
      type = 'sai'
    }
    const c = await callContext()
    await openNextDraw(c, type)
  })

program
  .command('rollover [type]')
  .description('rollover and open the next draw. Type is one of sai | dai.  Defaults to sai')
  .action(async (type) => {
    ranAction = true
    if (!type) {
      type = 'sai'
    }
    const c = await callContext()
    await rollover(c, type)
  })

program
  .command('transfer')
  .description('transfer some sai between users.')
  .action(async () => {
    ranAction = true
    const c = await callContext()
    await transfer(c)
  })

program
  .command('burn')
  .description('burn sai for the first user.')
  .action(async () => {
    ranAction = true
    const c = await callContext()
    await burn(c)
  })

program
  .command('withdraw-deposit [type] [count]')
  .description('tests withdrawals and deposits for top *count* users')
  .action(async (type, count) => {
    ranAction = true
    if (!type) {
      type = 'sai'
    }
    if (!count) {
      count = 5
    }
    await withdrawAndDeposit(await callContext(), type, count)
  })


program
  .command('winners [type] [count]')
  .description('precalculate winners')
  .action(async (type, count) => {
    ranAction = true
    if (!type) {
      type = 'sai'
    }
    if (!count) {
      count = 5
    }
    await calculateWinners(await callContext(), type, count)
  })

program
  .command('list')
  .description('list the top 10 users')
  .action(async () => {
    ranAction = true
    await showUsers()
  })

program
  .command('trace [hash]')
  .description('show a transaction trace for the given hash')
  .action(async (hash) => {
    ranAction = true
    await trace(await callContext(), hash)
  })

program
  .command('mint [type]')
  .description('transfers dai to the top 10 users.  Type is one of sai | dai.  Defaults to sai')
  .action(async (type) => {
    ranAction = true
    if (!type) {
      type = 'sai'
    }
    await mint(await callContext(), type)
  })

program
  .command('swap')
  .description('swaps sai to dai for the little sai buddy')
  .action(async () => {
    ranAction = true
    await swapSaiToDai(await callContext())
  })

program
  .command('wards')
  .description('Show whether the ScdMcdMigration contract is a ward for the SaiJoin')
  .action(async () => {
    ranAction = true
    await wards(await callContext())
  })

program
  .command('migrate-sai [count]')
  .description('migrates PoolSai for the top X users.')
  .action(async (count) => {
    ranAction = true
    if (!count) {
      count = '1'
    }
    await migrateSai(await callContext(), count)
  })

program
  .command('balances [type] [count]')
  .description('Displays Pool balances for the top X users.   Type is one of sai | dai.  Defaults to sai')
  .action(async (type, count) => {
    ranAction = true
    if (!type) {
      type = 'sai'
    }
    if (!count) {
      count = 10
    }
    await poolBalances(await callContext(), type, count)
  })

program.parse(process.argv)

if (!ranAction) {
  console.log(chalk.red(`No command given.`))
  program.outputHelp()
  process.exit(1)
}