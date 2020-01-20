const { fetchUsers } = require('./fetchUsers')
const chalk = require('chalk')

async function poolBalances (context, type, count = '10') {
  console.log(chalk.yellow(`Checking ${type} balances...`))
  const {
    contracts,
    ethers
  } = context

  const users = await fetchUsers(parseInt(count, 10))

  let pool

  switch (type) {
    case 'dai':
      pool = contracts.PoolDai
      break
    default:
      pool = contracts.PoolSai
  }

  for (let i = 0; i < users.length; i++) {
    const user = users[i].address
    console.log(chalk.dim(`Checking balance for ${user}...`))
    const balance = await pool.balanceOf(user)
    console.log(chalk.dim(`${type} balance for ${user}: ${ethers.utils.formatEther(balance)}`))
  }

  console.log(chalk.green('Done balances.'))
}

module.exports = {
  poolBalances
}
