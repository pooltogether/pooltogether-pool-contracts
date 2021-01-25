const chalk = require('chalk')
const {
  POOL_ADMIN,
} = require('./helpers/constants')
const { ethers } = require('ethers')
const toWei = ethers.utils.parseEther

async function setRewardFees (context) {

  const {
    interfaces,
    provider,
    loadNetworkConfig,
    ethers
  } = context

  provider.connection.timeout = 30 * 60 * 1000 // 30 minute timeout

  // Binance 7 account.  Has *tons* of Ether
  let poolAdmin = provider.getSigner(POOL_ADMIN)
  
  const networkConfig = loadNetworkConfig()

  const typeProxies = {
    'dai': networkConfig.proxies['pooltogether/PoolDai'][0],
    'sai': networkConfig.proxies['pooltogether/PoolSai'][0],
    'usdc': networkConfig.proxies['pooltogether/PoolUsdc'][0]
  }

  const daiPool = new ethers.Contract(typeProxies['dai'].address, interfaces.AutonomousPool.abi, poolAdmin)
  const saiPool = new ethers.Contract(typeProxies['sai'].address, interfaces.AutonomousPool.abi, poolAdmin)
  const usdcPool = new ethers.Contract(typeProxies['usdc'].address, interfaces.AutonomousPool.abi, poolAdmin)

  console.log(chalk.yellow(`Setting dai pool to 0.1...`))
  await daiPool.setNextFeeFraction(toWei('0.1'))
  console.log(chalk.yellow(`Setting sai pool to 0.5...`))
  await saiPool.setNextFeeFraction(toWei('0.5'))
  console.log(chalk.yellow(`Setting usdc pool to 0.5...`))
  await usdcPool.setNextFeeFraction(toWei('0.5'))

  console.log(chalk.green('Set all reward fees.'))
}

module.exports = {
  setRewardFees
}
