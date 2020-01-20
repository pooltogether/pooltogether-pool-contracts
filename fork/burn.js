const chalk = require('chalk')
const { expect } = require('chai')
const { fetchUsers } = require('./fetchUsers')
const { exec } = require('./exec')
const { ethers } = require('ethers')

const OVERRIDES = {
  gasLimit: 6700000
}

async function burn(context) {
  console.log(chalk.yellow('Starting burn...'))

  const {
    contracts,
    provider
  } = context

  const users = await fetchUsers()

  const user1 = users[0].address

  const poolSai = contracts.PoolSai.connect(provider.getSigner(user1))

  const balanceBefore = await poolSai.balanceOf(user1)
  console.log(chalk.dim(`Balance before: ${ethers.utils.formatEther(balanceBefore)}`))

  await exec(provider, poolSai.burn(ethers.utils.parseEther('100'), OVERRIDES))

  const balanceAfter = await poolSai.balanceOf(user1)
  console.log(chalk.dim(`Balance after: ${ethers.utils.formatEther(balanceAfter)}`))

  console.log(chalk.green('Done burn.'))
}

module.exports = {
  burn
}