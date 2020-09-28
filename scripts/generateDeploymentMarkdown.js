#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const glob = require('glob')
const find = require('find')

const networks = ['rinkeby', 'ropsten', 'kovan']

const ignoreContracts = [
  'ProxyAdmin',
  'ProxyFactory',
  'Comptroller',
  'ComptrollerImplementation',
  'CompoundPrizePoolProxyFactory',
  'ControlledTokenProxyFactory',
  'SingleRandomWinnerProxyFactory',
  'TicketProxyFactory',
  'yVaultPrizePoolProxyFactory',
  'StakePrizePoolProxyFactory'
]

const baseUrl = "https://github.com/pooltogether/pooltogether-pool-contracts/tree/version-3"
const outputFile = `./Networks.md`

const { contractAddresses } = require('@pooltogether/current-pool-data')

const networkPoolConfig = {
  rinkeby: [
    {	
      address: contractAddresses['4'].DAI_POOL_CONTRACT_ADDRESS,
      name: 'cDAI Prize Pool'
    },
    {
      address: contractAddresses['4'].USDC_POOL_CONTRACT_ADDRESS,
      name: 'cUSDC Prize Pool'
    },
    {
      address: contractAddresses['4'].USDT_POOL_CONTRACT_ADDRESS,
      name: 'cUSDT Prize Pool'
    }
  ]
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

async function generate() {
  const out = fs.openSync(outputFile, 'w')
  const append = (str) => {
    fs.writeSync(out, str + "\n")
  }

  const appendNoNewline = (str) => {
    fs.writeSync(out, str)
  }

  append(`# 📡 Networks`)
  append(``)

  for (let ni = 0; ni < networks.length; ni++) {
    const network = networks[ni]

    console.log(chalk.yellow(`Generating network ${network}...`))
  
    append(`## ${capitalizeFirstLetter(network)}`)
    append('')

    append(`| Contract | Address | Artifact |`)
    append(`| :--- | :--- | :--- |`)

    if (networkPoolConfig[network] && networkPoolConfig[network].length) {
      for (let npi = 0; npi < networkPoolConfig[network].length; npi++) {
        const pool = networkPoolConfig[network][npi]
        appendNoNewline(`| `)
        appendNoNewline(`[${pool.name}](${baseUrl + '/contracts/prize-pool/PrizePool.sol'})`)
        appendNoNewline(` ([open app](https://staging-v3.pooltogether.com)`)
        append(` | [${pool.address}](https://${network}.etherscan.io/address/${pool.address}) | [ABI](/.gitbook/assets/prizepoolabi.json) |`)
      }
    }

    const contractPaths = glob.sync(`${__dirname}/../deployments/${network}/*.json`)
  
    for (let cpi = 0; cpi < contractPaths.length; cpi++) {
      const contractPath = contractPaths[cpi]
  
      const contract = JSON.parse(fs.readFileSync(contractPath))
      const contractName = path.basename(contractPath, ".json")
  
  
      if (!ignoreContracts.includes(contractName)) {
        console.log(chalk.dim(`Found contract ${contractName}...`))
  
        const solidityFilepaths = find.fileSync(`${contractName}.sol`, `${__dirname}/../contracts`)
        let contractLink
        if (solidityFilepaths.length > 0) {
          const solidityFilePath = solidityFilepaths[0].split("/contracts")[1]
          contractLink = `[${contractName}](${baseUrl}/contracts${solidityFilePath})`
        } else {
          contractLink = contractName
        }
  
        append(`| ${contractLink} | [${contract.address}](https://${network}.etherscan.io/address/${contract.address}) | [Artifact](${baseUrl + `/deployments/${network}/${path.basename(contractPath)}`}) |`)
      } else {
        console.log(chalk.dim(`Ignoring contract ${contractName}`))
      }
    }
  
    console.log(chalk.green(`Done ${network}!`))
    append('')
  }
  
  append('')
  append('')
  append('')
  append(`*This document was generated using a [script](${baseUrl + `scripts/generateDeploymentMarkdown.js`})*`)
  append('')
  
  fs.closeSync(out)  

  console.log(chalk.green(`Output to ${outputFile}`))
}

generate()
