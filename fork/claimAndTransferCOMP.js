const {
  BINANCE_ADDRESS
} = require('./helpers/constants')

async function claimAndTransferCOMP (context, type = 'dai') {

  const {
    interfaces,
    provider,
    loadNetworkConfig,
    ethers
  } = context

  // Binance 7 account.  Has *tons* of Ether
  let binance = provider.getSigner(BINANCE_ADDRESS)
  
  const networkConfig = loadNetworkConfig()

  const typeProxies = {
    'dai': networkConfig.proxies['pooltogether/PoolDai'][0],
    'sai': networkConfig.proxies['pooltogether/PoolSai'][0],
    'usdc': networkConfig.proxies['pooltogether/PoolUsdc'][0]
  }

  const proxy = typeProxies[type]

  const pool = new ethers.Contract(proxy.address, interfaces.AutonomousPool.abi, binance)

  const tx = await pool.claimAndTransferCOMP()

  let receipt = await provider.getTransactionReceipt(tx.hash)
  let events = receipt.logs.reduce((logs, log) => { let e = pool.interface.parseLog(log); if (e) { logs.push(e) } return logs }, [])
  let event = events.find(event => event.name == 'TransferredComp')
  console.log(`${ethers.utils.formatEther(event.values.amount)} COMP transferred to ${event.values.recipient}`, )
}

module.exports = {
  claimAndTransferCOMP
}
