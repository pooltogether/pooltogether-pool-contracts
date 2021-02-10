const chalk = require('chalk')
const {
  fetchAllUsers
 } = require('./fetchAllUsers')
const { runShell } = require('./runShell')

async function startFork() {
  console.log(chalk.green('Starting fork...'))
  const ganache = require("ganache-cli");

  // runShell(`cp .openzeppelin/mainnet.json .openzeppelin/dev-999.json`)

  console.warn("NOTE: Make sure a Hardhat fork is running on port 8546!")

  runShell(`cp .openzeppelin/mainnet.json .openzeppelin/dev-31337.json`)
  runShell(`cp .oz-migrate/mainnet .oz-migrate/mainnet_fork`)

  let unlockedAccounts = fetchAllUsers();

  console.log(chalk.dim(`Unlocked: \n\t${unlockedAccounts.join('\n\t')}`))

  // const server = ganache.server({
  //   fork: process.env.GANACHE_FORK_URL,
  //   unlocked_accounts: unlockedAccounts,
  //   network_id: 999,
  //   gasLimit: 20000000,
  //   defaultTransactionGasLimit: 20000000,
  //   allowUnlimitedContractSize: true
  // });

  // await new Promise((resolve, reject) => {
  //   server.listen('8546', function(err, blockchain) {
  //     if (err) { reject(err) }
  //     if (blockchain) { resolve(blockchain) }
  //   })
  // })

  console.log(chalk.green('Started fork'))
}

module.exports = {
  startFork
}