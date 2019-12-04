#!/usr/bin/env node
const chalk = require('chalk')
const loadUsers = require('./loadUsers')
const forkMainnet = require('./forkMainnet')

const {
  BINANCE_ADDRESS,
  DEPLOY_ADMIN,
  SAI_BUDDY,
  MULTISIG_ADMIN1,
  MULTISIG_ADMIN2,
} = require('./constants')

async function run() {
  const users = await loadUsers()
  console.log(`Found ${users.length} users`)

  const unlockedAccounts = users.map(user => user.id).concat([
    BINANCE_ADDRESS,
    DEPLOY_ADMIN,
    SAI_BUDDY,
    MULTISIG_ADMIN1,
    MULTISIG_ADMIN2,
  ])

  await forkMainnet({ unlockedAccounts })
}

console.log(chalk.green('Starting fork...'))
run().then(() => {
  console.log(chalk.green('Started fork'))
})
