#!/usr/bin/env node
const shell = require('shelljs')
const chalk = require('chalk')

function runShell(cmd) {
  console.log(chalk.dim(`$ ${cmd}`))
  const result = shell.exec(cmd)
  if (result.code !== 0) {
    console.error(chalk.red(cmd))
    throw new Error(`Could not run ${cmd}:`, result)
  }
}

module.exports = {
  runShell
}