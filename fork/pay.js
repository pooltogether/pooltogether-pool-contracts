const { fetchAllUsers } = require('./fetchAllUsers')
const { exec } = require('./exec')
const chalk = require('chalk')
const {
  BINANCE_ADDRESS,
} = require('./helpers/constants')

async function pay (context) {
  console.log(chalk.yellow('Starting ethers payments to admin and users...'))

  const {
    provider,
    ethers
  } = context
  
  let users = fetchAllUsers()

  // Binance 7 account.  Has *tons* of Ether
  let binance = provider.getSigner(BINANCE_ADDRESS)

  for (let i = 0; i < users.length; i++) {
    let user = users[i]
    // Transfer eth to the admin so that we can deploy contracts
    await exec(provider, binance.sendTransaction({ to: user, value: ethers.utils.parseEther('100') }))
    console.log(chalk.dim(`${i+1}/${users.length}: ${user} received 100 ether`))
  }
  
  console.log(chalk.green('Complete payments.'))
}

module.exports = {
  pay
}
