#!/usr/bin/env node
const chalk = require('chalk')
const { fetchUsers } = require('./fetchUsers')
const { ethers } = require('ethers')

async function showUsers() {
  console.log(chalk.green('Retrieving users...'))
  const users = await fetchUsers()

  richest = users.map(user => ({
    balance: ethers.utils.formatEther(user.balance),
    address: user.id
  }))

  console.log(richest)

  console.log(chalk.green('Done.'))
}

module.exports = {
  showUsers
}