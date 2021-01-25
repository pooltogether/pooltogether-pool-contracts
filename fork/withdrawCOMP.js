const chalk = require('chalk')
const {
  POOL_ADMIN,
} = require('./helpers/constants')

async function withdrawCOMP (context, type = 'dai') {

  const {
    contracts,
    interfaces,
    provider,
    loadNetworkConfig,
    ethers
  } = context

  provider.connection.timeout = 30 * 60 * 1000 // 30 minute timeout

  // Binance 7 account.  Has *tons* of Ether
  let binance = provider.getSigner(POOL_ADMIN)
  
  const networkConfig = loadNetworkConfig()

  const typeProxies = {
    'dai': networkConfig.proxies['pooltogether/PoolDai'][0],
    'sai': networkConfig.proxies['pooltogether/PoolSai'][0],
    'usdc': networkConfig.proxies['pooltogether/PoolUsdc'][0]
  }

  const proxy = typeProxies[type]

  const contract = new ethers.Contract(proxy.address, interfaces.AutonomousPool.abi, binance)
  const safe = '0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f'
  const comp = new ethers.Contract('0xc00e94cb662c3520282e6f5717214004a7f26888', interfaces.IERC20.abi, binance)

  console.log(chalk.yellow(`Starting COMP balance is: ${ethers.utils.formatEther(await comp.balanceOf(safe))}`))
  console.log(chalk.yellow(`Withrawing COMP from ${proxy.address}...`))

  await contract.withdrawCOMP()
  
  console.log(chalk.yellow(`Final COMP balance is: ${ethers.utils.formatEther(await comp.balanceOf(safe))}`))

  console.log(chalk.green('Rewarding complete.'))
}

module.exports = {
  withdrawCOMP
}
