const chalk = require('chalk')
const {
  fetchUsers
 } = require('./fetchUsers')
const forkMainnet = require('./forkMainnet')
const { runShell } = require('./runShell')

const {
  BINANCE_ADDRESS,
  SAI_BUDDY,
  MULTISIG_ADMIN1,
  MULTISIG_ADMIN2,
  DAI_BUDDY
} = require('./constants')

async function startFork() {
  console.log(chalk.green('Starting fork...'))

  runShell(`cp .openzeppelin/mainnet.json .openzeppelin/dev-999.json`)

  const users = await fetchUsers()
  console.log(`Found ${users.length} users`)

  const unlockedAccounts = users.map(user => user.id).concat([
    BINANCE_ADDRESS,
    process.env.ADMIN_ADDRESS,
    SAI_BUDDY,
    MULTISIG_ADMIN1,
    MULTISIG_ADMIN2,
    DAI_BUDDY
  ])

  await forkMainnet({ unlockedAccounts })

  console.log(chalk.green('Started fork'))
}

module.exports = {
  startFork
}