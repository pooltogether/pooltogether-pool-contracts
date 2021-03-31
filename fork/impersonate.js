const { fetchAllUsers } = require('./fetchAllUsers')
const chalk = require('chalk')

async function impersonate (context) {
  console.log(chalk.yellow('Starting impersonation...'))

  const {
    provider
  } = context
  
  let users = fetchAllUsers()

  for (let i = 0; i < users.length; i++) {
    let user = users[i]
    console.log(chalk.dim(`Impersonating ${user}...`))
    await provider.send("hardhat_impersonateAccount", [user])
  }
  
  console.log(chalk.green('Complete impersonation.'))
}

module.exports = {
  impersonate
}


