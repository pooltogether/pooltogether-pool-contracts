const chalk = require('chalk')
const {
  BINANCE_ADDRESS,
} = require('./helpers/constants')

async function rewardAuto (context, type = 'dai', count = 5) {

  const {
    contracts,
    interfaces,
    provider,
    loadNetworkConfig,
    ethers
  } = context

  provider.connection.timeout = 30 * 60 * 1000 // 30 minute timeout

  // Binance 7 account.  Has *tons* of Ether
  let binance = provider.getSigner(BINANCE_ADDRESS)
  
  const networkConfig = loadNetworkConfig()

  const typeProxies = {
    'dai': networkConfig.proxies['pooltogether/PoolDai'][0],
    'sai': networkConfig.proxies['pooltogether/PoolSai'][0],
    'usdc': networkConfig.proxies['pooltogether/PoolUsdc'][0]
  }

  const proxy = typeProxies[type]

  const contract = new ethers.Contract(proxy.address, interfaces.AutonomousPool.abi, binance)

  for (let i = 0; i < count; i++) {
    console.log(`At ${i} out of ${count}`)

    const committedDrawId = await contract.currentCommittedDrawId()
    console.log(chalk.yellow(`Starting ${type} award ${committedDrawId.toString()}...`))
    const seconds = (await contract.prizePeriodSeconds()).toNumber() + 1
    console.log(chalk.dim(`Increasing time by ${seconds}`))
    await provider.send('evm_increaseTime', [seconds])
    
    let cooldownBlock = await contract.cooldownEndAt()
    console.log(chalk.dim(`Lock cooldown ends at ${cooldownBlock.toString()}`))
    while ((await provider.getBlockNumber()) < cooldownBlock.toNumber()) {
      await provider.send('evm_mine', [])
    }
    console.log(chalk.dim(`Block is now ${await provider.getBlockNumber()}`))

    console.log(chalk.dim(`Locking tokens...`))
    await contract.lockTokens()
    console.log(chalk.dim(`Rewarding...`))
    let tx = await contract.reward()
    console.log(chalk.green(`Rewarded ${committedDrawId}`))

    let receipt = await provider.getTransactionReceipt(tx.hash)
    let rewardEvents = receipt.logs.reduce((logs, log) => { let e = contract.interface.parseLog(log); if (e) { logs.push(e) } return logs }, [])
    // console.log(rewardEvents)
    let rewarded = rewardEvents.find(event => event.name == 'Rewarded')
    let awardedCOMP = rewardEvents.find(event => event.name == 'AwardedCOMP')
    let feeCollected = rewardEvents.find(event => event.name == 'FeeCollected')

    if (awardedCOMP) { console.log('Comp reward: ', ethers.utils.formatEther(awardedCOMP.values.amount)) }
    console.log('Prize: ', ethers.utils.formatEther(rewarded.values.winnings))
    console.log('Reward fee: ', ethers.utils.formatEther(feeCollected.values.amount))
  }
  
  console.log(chalk.green('Rewarding complete.'))
}

module.exports = {
  rewardAuto
}
