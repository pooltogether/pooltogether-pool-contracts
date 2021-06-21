#!/usr/bin/env node
const chalk = require('chalk')
const util = require('util')
const find = require('find')
const fs = require('fs')
const exec = util.promisify(require('child_process').exec)
const hardhat = require('hardhat')

const info = (msg) => console.log(chalk.dim(msg))
const success = (msg) => console.log(chalk.green(msg))
const error = (msg) => console.error(chalk.red(msg))

const getContract = async (name) => {
  const { deployments } = hardhat
  const signers = await hardhat.ethers.getSigners()
  return hardhat.ethers.getContractAt(name, (await deployments.get(name)).address, signers[0])
}

const verifyAddress = async (address, name) => {
  const network = hardhat.network.name
  let config 
  if(isBinance()){
    config = '--config hardhat.config.bsc.js'
  }
  else if(isPolygon()){
    console.log("using polygon config")
    config ='--config hardhat.config.polygon.js'
  }
  else {
    config = ''
  }
  
  try {
    console.log(`running: hardhat ${config} verify --network ${network} ${address}`)
    await exec(`hardhat ${config} verify --network ${network} ${address}`)
  } catch (e) {
    if (/Contract source code already verified/.test(e.message)) {
      info(`${name} already verified`)
    } else {
      error(e.message)
      console.error(e)
    }
  }
}

const verifyProxyFactory = async (name) => {
  const proxyFactory = await getContract(name)
  const instanceAddress = await proxyFactory.instance()
  info(`Verifying ${name} instance at ${instanceAddress}...`)
  await verifyAddress(instanceAddress, name)
  success(`Verified!`)
}

function isBinance() {
  const network = hardhat.network.name
  return /bsc/.test(network);
}

function isPolygon() {
  const network = hardhat.network.name
  return /polygon/.test(network) || /matic/.test(network)
}

function etherscanApiKey() {
  if (isBinance()) {
    info(`Using bsc scan api key`)
    return process.env.BSCSCAN_API_KEY
  } 
  else if(isPolygon()){
    info(`Using polygonscan api key`)
    return process.env.POLYGONSCAN_API_KEY
  }
  else {
    return process.env.ETHERSCAN_API_KEY
  }
}


/*
needs to be in form: ardhat verify --config hardhat.config.polygon.js --network matic 0x5effa0823e486A5ED1D49d88A1374Fc337e1f9F4 
  --contract contracts/builders/PoolWithMultipleWinnersBuilder.sol:PoolWithMultipleWinnersBuilder 
"0x20F29CCaE4c9886964033042c6b79c2C4C816308" "0x41122Ca50202d13c809dfE88F60Da212A1525Ed7" "0x4d1639e4b237BCab6F908A1CEb0995716D5ebE36" 
"0xaFcEa072BcBad91029A2bA0b37bAC8269dd4f5E6" "0x72Edd573E230C7d68274Bf718A4C6aD82b5d5f90"
*/
async function verifyPolygonScan(){


  info(`verifying contracts on PolygonScan`)

  const filePath = "./deployments/matic/"
  const config ='--config hardhat.config.polygon.js'

  let toplevelContracts = []

  fs.readdirSync(filePath).filter((fileName) => {
    // console.log("found fileName ", fileName)
    if(fileName.includes(".json")){

      const contractName = (fileName.substring(0, fileName.length - 5)).trim() // strip .json
      const contractDirPath = (find.fileSync(contractName+".sol", "./contracts"))[0]
      if(!contractDirPath){
        error(`There is no matching contract for ${contractName}. This is likely becuase the deployment contract name is different from the Solidity contract title.
         Run verification manually. See verifyPolygonScan() for details`)
         return
      }
      const deployment = JSON.parse(fs.readFileSync(filePath+fileName, "utf8"))

      toplevelContracts.push({
        address: deployment.address,
        contractName: contractDirPath + ":" + contractName,
        constructorArgs : deployment.args
      })
    }
  })

  info(`${toplevelContracts.length} contracts to verify`)

  toplevelContracts.forEach(async (contract)=>{
    // console.log("attempting to verify ", contract)

    let args = ""

    if(contract.constructorArgs.length > 0){
      contract.constructorArgs.forEach((arg)=>{
        args = args.concat("\"", arg, "\" ") // format constructor args in correct form
      })    
    }
    
    try {
      // console.log(`running: hardhat ${config} verify --network matic ${contract.address} --contract ${contract.contractName} ${args}`)
      await exec(`hardhat ${config} verify --network matic ${contract.address} --contract ${contract.contractName} ${args}`)
    } catch (e) {
      if (/Contract source code already verified/.test(e.message)) {
        info(`${contract.contractName} already verified`)
      } else {
        error(e.message)
        console.error(e)
      }
    }


  })
}


async function run() {
  const network = hardhat.network.name

  info(`Verifying top-level contracts on network: ${network}`)

  if(network == "matic"){
    await verifyPolygonScan()
  }
  else {  
    info(`verifying contracts using etherscan-verify plugin`)
    const { stdout, stderr } = await exec(
      `hardhat --network ${network} etherscan-verify --solc-input --api-key ${etherscanApiKey()}`
    )
    console.log(chalk.yellow(stdout))
    console.log(chalk.red(stderr))
  }

  info(`Done top-level contracts`)

  info(`Verifying proxy factory instances...`)

  await verifyProxyFactory('CompoundPrizePoolProxyFactory')
  await verifyProxyFactory('ControlledTokenProxyFactory')
  await verifyProxyFactory('MultipleWinnersProxyFactory')
  await verifyProxyFactory('StakePrizePoolProxyFactory')
  await verifyProxyFactory('TicketProxyFactory')
  await verifyProxyFactory('TokenFaucetProxyFactory')
  await verifyProxyFactory('YieldSourcePrizePoolProxyFactory')

  success('Done!')
}

run()
