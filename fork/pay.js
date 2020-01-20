const { fetchUsers } = require('./fetchUsers')
const chai = require('chai')
const { exec } = require('./exec')
const chalk = require('chalk')
const {
  BINANCE_ADDRESS,
  HD_FIRST_ADDRESS,
  LITTLE_SAI_GUY
} = require('./helpers/constants')

async function pay (context, count = '5') {
  console.log(chalk.yellow('Starting ethers payments to admin and users...'))

  const {
    provider,
    ethers
  } = context

  count = parseInt(count, 10)

  const users = await fetchUsers(count)

  // Binance 7 account.  Has *tons* of Ether
  let binance = provider.getSigner(BINANCE_ADDRESS)

  // Transfer eth to the admin so that we can deploy contracts
  await exec(provider, binance.sendTransaction({ to: process.env.ADMIN_ADDRESS, value: ethers.utils.parseEther('100') }))
  console.log(chalk.dim(`ProxyAdmin ${process.env.ADMIN_ADDRESS} received 100 ether`))

  await exec(provider, binance.sendTransaction({ to: LITTLE_SAI_GUY, value: ethers.utils.parseEther('100') }))
  console.log(chalk.dim(`LITTLE_SAI_GUY received 100 ether`))

  await exec(provider, binance.sendTransaction({ to: HD_FIRST_ADDRESS, value: ethers.utils.parseEther('100') }))
  console.log(chalk.dim(`HD_FIRST_ADDRESS received 100 ether`))

  for (let i = 0; i < users.length; i++) {
    const user = users[i].address
    await exec(provider, binance.sendTransaction({ to: user, value: ethers.utils.parseEther('100') }))
    console.log(chalk.dim(`${user} received 100 ether`))
  }

  console.log(chalk.green('Complete payments.'))
}

module.exports = {
  pay
}
