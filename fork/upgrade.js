#!/usr/bin/env node
const chalk = require('chalk')
const { upgradeProxy } = require('./helpers/upgradeProxy')

async function upgrade (context) {
  console.log(chalk.yellow('Upgrading proxies using deployed implementations...'))
  
  const {
    contracts,
    loadNetworkConfig
  } = context

  // Expect the user to have pushed the contracts
  let networkConfig = loadNetworkConfig()
  const proxyNames = Object.keys(networkConfig.proxies)
  for (let i = 0; i < proxyNames.length; i++) {
    let proxyName = proxyNames[i]
    proxyName = proxyName.replace('pooltogether/', '')
    console.log(chalk.grey(`Checking proxy ${proxyName}...`))
    const contract = contracts[proxyName]
    const newImpl = networkConfig.contracts[proxyName]
    const currentImplAddress = await contracts.ProxyAdmin.getProxyImplementation(contract.address)
    if (currentImplAddress != newImpl.address) {
      console.log(chalk.yellow(`Upgrading ${proxyName} at ${contract.address} from implementation at ${currentImplAddress} to ${newImpl.address}...`))
      await upgradeProxy(context, contract.address, newImpl.address)
      console.log(chalk.green(`Successfully upgraded ${proxyName} to new implementation at ${newImpl.address}`))
    }
  }

  console.log(chalk.green("Upgraded."))
}

module.exports = {
  upgrade
}
