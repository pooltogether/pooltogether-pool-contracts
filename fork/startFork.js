const chalk = require('chalk')
const {
  fetchUsers
 } = require('./fetchUsers')
const { runShell } = require('./runShell')

const {
  POOL_ADMIN,
  BINANCE_ADDRESS,
  SAI_BUDDY,
  HD_FIRST_ADDRESS,
  LITTLE_SAI_GUY,
  MULTISIG_ADMIN1,
  MULTISIG_ADMIN2,
  DAI_BUDDY
} = require('./helpers/constants')

async function startFork() {
  console.log(chalk.green('Starting fork...'))
  const ganache = require("ganache-cli");

  runShell(`cp .openzeppelin/mainnet.json .openzeppelin/dev-999.json`)
  runShell(`cp .oz-migrate/mainnet .oz-migrate/mainnet_fork`)

  const users = await fetchUsers()

  const unlockedAccounts = users.map(user => user.address).concat([
    POOL_ADMIN,
    BINANCE_ADDRESS,
    HD_FIRST_ADDRESS,
    process.env.ADMIN_ADDRESS,
    SAI_BUDDY,
    LITTLE_SAI_GUY,
    MULTISIG_ADMIN1,
    MULTISIG_ADMIN2,
    DAI_BUDDY
  ])

  console.log(chalk.dim(`Unlocked: \n\t${unlockedAccounts.join('\n\t')}`))

  const server = ganache.server({
    fork: process.env.GANACHE_FORK_URL,
    unlocked_accounts: unlockedAccounts,
    network_id: 999,
    gasLimit: 20000000,
    defaultTransactionGasLimit: 20000000,
    allowUnlimitedContractSize: true
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