const chalk = require('chalk')
const loadUsers = require('./loadUsers')
const forkMainnet = require('./forkMainnet')
const { runShell } = require('./runShell')

const {
  BINANCE_ADDRESS,
  SAI_BUDDY,
  MULTISIG_ADMIN1,
  MULTISIG_ADMIN2,
} = require('./constants')

async function startFork() {
  console.log(chalk.green('Starting fork...'))

  const users = await loadUsers()
  console.log(`Found ${users.length} users`)

  const unlockedAccounts = users.map(user => user.id).concat([
    BINANCE_ADDRESS,
    process.env.ADMIN_ADDRESS,
    SAI_BUDDY,
    MULTISIG_ADMIN1,
    MULTISIG_ADMIN2,
  ])

  await forkMainnet({ unlockedAccounts })

  console.log(chalk.green('Started fork'))
}

module.exports = {
  startFork
}