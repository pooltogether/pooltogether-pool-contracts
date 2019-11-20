#!/usr/bin/env node
const chalk = require('chalk')
const loadUsers = require('./loadUsers')

async function run() {
  const users = await loadUsers()

  console.log(users.map(user => user.id))
}

console.log(chalk.green('Retrieving users...'))
run().then(() => {
  console.log(chalk.green('Done.'))
})
