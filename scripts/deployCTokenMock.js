#!/usr/bin/env node
const commander = require('commander');
const chalk = require('chalk')
const { runShell } = require('./runShell')

const program = new commander.Command()
program.description('Deploys the PoolTogether smart contracts')
program.option('-n --network [network]', 'configure OpenZeppelin network', 'kovan')
program.option('-a --address [address]', 'configures the address to deploy from', process.env.ADMIN_ADDRESS)

program.parse(process.argv)

runShell(`oz session --network ${program.network} --from ${program.address} --expires 3600 --timeout 600 --blockTimeout 50`)

let response = runShell(`oz deploy ERC20Mintable -n ${program.network} -k regular`)

let tokenAddress = response.stdout.trim()

console.log(chalk.green(`ERC20 Address: ${tokenAddress}`))

// should be about 20% APR
let supplyRate = '8888888888888'

response = runShell(`oz deploy -n ${program.network} -k regular CTokenMock ${tokenAddress} ${supplyRate}`)

cTokenAddress = response.stdout.trim()

console.log(chalk.green(`cToken Address: ${cTokenAddress}`))