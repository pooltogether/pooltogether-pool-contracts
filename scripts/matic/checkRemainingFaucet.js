const hardhat = require('hardhat')

const WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'

async function checkRemainingFaucet() {

  const { ethers } = hardhat
  const { provider } = ethers

  const signers = await ethers.getSigners()

  const wmatic = await ethers.getContractAt('IERC20Upgradeable', WMATIC_ADDRESS, signers[0])
  const faucet = await ethers.getContractAt('TokenFaucet', '0x90a8d8Ee6fDb1875028C6537877E6704b2646c51', signers[0])

  const balance = await wmatic.balanceOf(faucet.address)
  const unclaimed = await faucet.totalUnclaimed()
  const remaining = balance.sub(unclaimed)

  const tokensPerSecond = await faucet.dripRatePerSecond()

  const seconds = remaining.div(tokensPerSecond)


  console.log(`${parseInt(seconds.toString()) / 86400.0} days remaining`)
}

checkRemainingFaucet()