#!/usr/bin/env node
const chalk = require('chalk')
const util = require('util')
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
    return process.env.BSCSCAN_API_KEY
  } 
  else if(isPolygon()){
    info(`using polygonscan api key`)
    return process.env.POLYGONSCAN_API_KEY
  }
  else {
    return process.env.ETHERSCAN_API_KEY
  }
}

async function verifyPolyscan(){
  info(`verifying contracts on PolygonScan`)

  const filePath = "../deployments/matic"

  const toplevelContracts = fs.readdirSync(filePath).filter((fileName) => {
    if(fileName.contains(".json")){
      return {
        address: (JSON.parse(fs.readFileSync(, "utf8"))).address,
        contractName: +":"+fileName.substring(0, fileName.length - 5) // TODO: need to match contract/**/* filepath format as below
      }
    }
  })
}
/*
hardhat verify --config hardhat.config.polygon.js --network matic address -contract contracts/prize-pool/compound/CompoundPrizePoolProxyFactory.sol:CompoundPrizePoolProxyFactory
hardhat verify --config hardhat.config.polygon.js --network matic 0x08411ADd0b5AA8ee47563b146743C13b3556c9Cc --contract contracts/token/ControlledTokenProxyFactory.sol:ControlledTokenProxyFactory
hardhat verify --config hardhat.config.polygon.js --network matic 0x317625b28Acb3C0540DB00b179D84D9b804277f7 --contract contracts/builders/ControlledTokenBuilder.sol:ControlledTokenBuilder "0x08411ADd0b5AA8ee47563b146743C13b3556c9Cc" "0x58aF4554c0DB496EFdf93bB344eC513C5627Efb9"
hardhat verify --config hardhat.config.polygon.js --network matic 0xdc488E6e8c55a11d20032997cd1fF7c4951401df --contract contracts/prize-strategy/multiple-winners/MultipleWinnersProxyFactory.sol:MultipleWinnersProxyFactory
hardhat verify --config hardhat.config.polygon.js --network matic 0x58aF4554c0DB496EFdf93bB344eC513C5627Efb9 --contract contracts/token/TicketProxyFactory.sol:TicketProxyFactory
hardhat verify --config hardhat.config.polygon.js --network matic 0x4d1639e4b237BCab6F908A1CEb0995716D5ebE36 --contract contracts/prize-pool/yield-source/YieldSourcePrizePoolProxyFactory.sol:YieldSourcePrizePoolProxyFactory
hardhat verify --config hardhat.config.polygon.js --network matic 0xaFcEa072BcBad91029A2bA0b37bAC8269dd4f5E6 --contract contracts/prize-pool/stake/StakePrizePoolProxyFactory.sol:StakePrizePoolProxyFactory
hardhat verify --config hardhat.config.polygon.js --network matic 0xB3e8bBD6CB0443e0dc59602825Dc6854D7ec5c4b --contract contracts/token-faucet/TokenFaucetProxyFactory.sol:TokenFaucetProxyFactory
hardhat verify --config hardhat.config.polygon.js --network matic 0x5effa0823e486A5ED1D49d88A1374Fc337e1f9F4 --contract contracts/builders/PoolWithMultipleWinnersBuilder.sol:PoolWithMultipleWinnersBuilder "0x20F29CCaE4c9886964033042c6b79c2C4C816308" "0x41122Ca50202d13c809dfE88F60Da212A1525Ed7" "0x4d1639e4b237BCab6F908A1CEb0995716D5ebE36" "0xaFcEa072BcBad91029A2bA0b37bAC8269dd4f5E6" "0x72Edd573E230C7d68274Bf718A4C6aD82b5d5f90"
hardhat verify --config hardhat.config.polygon.js --network matic 0x20F29CCaE4c9886964033042c6b79c2C4C816308 --contract contracts/registry/Registry.sol:Registry
*/






async function run() {
  const network = hardhat.network.name

  info(`Verifying top-level contracts on network: ${network}`)
  const { stdout, stderr } = await exec(
    `hardhat --network ${network} etherscan-verify --solc-input --api-key ${etherscanApiKey()}`
  )
  console.log(chalk.yellow(stdout))
  console.log(chalk.red(stderr))


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
