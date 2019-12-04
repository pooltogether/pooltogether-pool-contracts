#!/usr/bin/env node
const chalk = require('chalk')
const loadUsers = require('./loadUsers')
const { ethers } = require('ethers')

async function showUsers() {
  console.log(chalk.green('Retrieving users...'))
  const users = await loadUsers()

  richest = users.slice(0, 10).map(user => ({
    balance: ethers.utils.formatEther(user.balance),
    address: user.id
  }))

  console.log(richest)

  console.log(chalk.green('Done.'))
}

module.exports = {
  showUsers
}