const chalk = require('chalk')
const {
  fetchAllUsers
 } = require('./fetchAllUsers')
const { runShell } = require('./runShell')
const { impersonate } = require('./impersonate')
const { pay } = require('./pay')
const { pushContracts } = require('./pushContracts')

async function setupFork(context) {
  console.log(chalk.red("!!! You should be running a Hardhat fork is running on port 8546 !!!"))

  runShell(`cp .openzeppelin/mainnet.json .openzeppelin/dev-31337.json`)
  runShell(`cp .oz-migrate/mainnet .oz-migrate/mainnet_fork`)
  
  console.log(chalk.green(`Copied over mainnet setup`))

  await impersonate(context)
  await pay(context)
  await pushContracts(context)
}

module.exports = {
  setupFork
}