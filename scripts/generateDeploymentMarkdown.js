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
  'TicketProxyFactory'
]

const baseUrl = "https://github.com/pooltogether/pooltogether-pool-contracts/tree/version-3"
const outputFile = `./Networks.md`

const networkPoolConfig = {
  rinkeby: [
    {	
      address: '0xe19d8b62Bbb53F3e5d2c62e361240a6d3Ad4084F',
      name: 'Compound cDAI Prize Pool'
    },
    {
      address: '0x5f4d901082229b7FBf2afd4d3Ac970De2eB2AB92',
      name: 'Compound cUSDC Prize Pool'
    },
    {
      address: '0x832B459C0Bc3FB10F2Aa62c70eDf5918085315c1',
      name: 'Compound cUSDT Prize Pool'
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

  for (let ni = 0; ni < networks.length; ni++) {
    const network = networks[ni]

    console.log(chalk.yellow(`Generating network ${network}...`))
  
    append(`# ${capitalizeFirstLetter(network)}`)
    append('')

    append(`| Contract | Address | Artifact |`)
    append(`| :--- | :--- | :--- |`)

    if (networkPoolConfig[network] && networkPoolConfig[network].length) {
      for (let npi = 0; npi < networkPoolConfig[network].length; npi++) {
        const pool = networkPoolConfig[network][npi]
        append(`| [${pool.name}](${baseUrl + '/contracts/prize-pool/PrizePool.sol'}) | [${pool.address}](https://${network}.etherscan.io/address/${pool.address}) | [ABI](/.gitbook/assets/prizepoolabi.json) |`)
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
}

generate()
