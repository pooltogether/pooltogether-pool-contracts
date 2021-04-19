const hardhat = require('hardhat')
const chalk = require("chalk")

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}

const { ethers } = hardhat

const timelockAddress = '0x42cd8312D2BCe04277dD5161832460e95b24262E'

async function run() {
  const timelock = await ethers.provider.getUncheckedSigner(timelockAddress)
  
  const { pool } = await getNamedAccounts()

  const poolToken = await ethers.getContractAt('IERC20Upgradeable', pool, timelock)
  
  const sablierAmount = '5141491200000000000000'
  const duration = '15552000'
  const poolPoolAddress = '0x396b4489da692788e327e2e4b2b0459a5ef26791'
  
  const sablierManager = await ethers.getContractAt('SablierManager', '0x0589C7a2b2acB895fF0314A394A6D991a9204444', timelock)
  
  dim(`${poolToken.address} approve ${sablierManager.address} ${sablierAmount}`)
  await poolToken.approve(sablierManager.address, sablierAmount)
  
  dim(`${sablierManager.address} createSablierStreamWithDuration ${poolPoolAddress} ${sablierAmount} ${poolToken.address} ${duration} ....`)
  await sablierManager.createSablierStreamWithDuration(poolPoolAddress, sablierAmount, poolToken.address, duration)
  
  
  const tokenFaucet = await ethers.getContractAt('TokenFaucet', '0x30430419b86e9512E6D93Fc2b0791d98DBeb637b', timelock)
  
  const faucetAmount = '18000000000000000000000'

  dim(`${poolToken.address} approve ${tokenFaucet.address} ${faucetAmount} ...`)
  await poolToken.approve(tokenFaucet.address, faucetAmount)

  dim(`${tokenFaucet.address} deposit ${faucetAmount}...`)
  await tokenFaucet.deposit(faucetAmount)

  green(`Done!`)
}

run()
