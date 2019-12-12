const chalk = require('chalk')
const {
  fetchUsers
 } = require('./fetchUsers')
const { runShell } = require('./runShell')

const {
  BINANCE_ADDRESS,
  SAI_BUDDY,
  LITTLE_SAI_GUY,
  MULTISIG_ADMIN1,
  MULTISIG_ADMIN2,
  DAI_BUDDY
} = require('./constants')

async function startFork() {
  console.log(chalk.green('Starting fork...'))
  const ganache = require("ganache-cli");

  runShell(`cp .openzeppelin/mainnet.json .openzeppelin/dev-999.json`)

  const users = await fetchUsers()
  console.log(`Found ${users.length} users`)

  const unlockedAccounts = users.map(user => user.id).concat([
    BINANCE_ADDRESS,
    process.env.ADMIN_ADDRESS,
    SAI_BUDDY,
    LITTLE_SAI_GUY,
    MULTISIG_ADMIN1,
    MULTISIG_ADMIN2,
    DAI_BUDDY
  ])

  const server = ganache.server({
    fork: process.env.GANACHE_FORK_URL,
    unlocked_accounts: unlockedAccounts,
    network_id: 999
  });

  await new Promise((resolve, reject) => {
    server.listen('8546', function(err, blockchain) {
      if (err) { reject(err) }
      if (blockchain) { resolve(blockchain) }
    })
  })

  console.log(chalk.green('Started fork'))
}

module.exports = {
  startFork
}