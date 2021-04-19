const hardhat = require('hardhat')
const chalk = require("chalk")
const { increaseTime } = require('../../test/helpers/increaseTime')

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}

const { ethers, deployments, getNamedAccounts } = hardhat

async function getStakePrizePoolProxy(tx) { 
  const stakePrizePoolProxyFactory = await ethers.getContract('StakePrizePoolProxyFactory')
  const createResultReceipt = await ethers.provider.getTransactionReceipt(tx.hash)
  const createResultEvents = createResultReceipt.logs.map(log => { try { return stakePrizePoolProxyFactory.interface.parseLog(log) } catch (e) { return null } })
  return createResultEvents[0].args.proxy
}

async function run() {
  const accounts = await getNamedAccounts()
  
  const protocolTreasury = await ethers.provider.getUncheckedSigner('0x42cd8312D2BCe04277dD5161832460e95b24262E')
  const pool = await ethers.getContractAt('ICompLike', accounts.pool, protocolTreasury)
  const builder = await ethers.getContract('PoolWithMultipleWinnersBuilder', protocolTreasury)

  let block = await ethers.provider.getBlock()

  const stakePrizePoolConfig = {
    token: pool.address,
    maxExitFeeMantissa: ethers.utils.parseEther('0.1'),
    maxTimelockDuration: 365 * 24 * 3600
  }

  const multipleWinnersConfig = {
    rngService: "0xb1D89477d1b505C261bab6e73f08fA834544CD21",
    prizePeriodStart: block.timestamp,
    prizePeriodSeconds: 1,
    ticketName: "TICKET",
    ticketSymbol: "TICK",
    sponsorshipName: "SPONSORSHIP",
    sponsorshipSymbol: "SPON",
    ticketCreditLimitMantissa: '0',
    ticketCreditRateMantissa: '0',
    numberOfWinners: 1,
    splitExternalErc20Awards: false
  }

  const tx = await builder.createStakeMultipleWinners(
    stakePrizePoolConfig,
    multipleWinnersConfig,
    18
  )

  const prizePool = await ethers.getContractAt('StakePrizePool', await getStakePrizePoolProxy(tx), protocolTreasury)

  green(`Created StakePrizePool ${prizePool.address}`)

  const prizeStrategy = await ethers.getContractAt('MultipleWinners', await prizePool.prizeStrategy(), protocolTreasury)
  await prizeStrategy.addExternalErc20Award('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')

  const sablierManager = await ethers.getContract('SablierManager', protocolTreasury)

  const poolStreamAmount = ethers.utils.parseEther('10')

  await pool.approve(prizePool.address, poolStreamAmount)
  dim(`Depositing ${ethers.utils.formatEther(poolStreamAmount)} Dai...`)
  await prizePool.depositTo(protocolTreasury._address, poolStreamAmount, await prizeStrategy.ticket(), ethers.constants.AddressZero)
  green(`Deposited`)

  dim(`Delegating votes...`)
  await prizePool.compLikeDelegate(pool.address, protocolTreasury._address)
  green(`Delegated`)
  
  dim(`Treasury votes: ${ethers.utils.formatEther(await pool.getCurrentVotes(protocolTreasury._address))}`)

  block = await ethers.provider.getBlock()
  let startTime = block.timestamp + 100
  
  await prizeStrategy.setBeforeAwardListener(sablierManager.address)
  await pool.approve(sablierManager.address, poolStreamAmount)
  await sablierManager.createSablierStream(prizePool.address, poolStreamAmount, pool.address, startTime, startTime + 100)

  dim(`Prize strategy owner: ${await prizeStrategy.owner()}`)

  await increaseTime(150)

  dim(`Starting award...`)
  await prizeStrategy.startAward()
  await increaseTime(1)
  dim(`Completing award...`)
  const awardTx = await prizeStrategy.completeAward()
  const awardReceipt = await ethers.provider.getTransactionReceipt(awardTx.hash)
  const awardLogs = awardReceipt.logs.map(log => { try { return prizePool.interface.parseLog(log) } catch (e) { return null }})
  const strategyLogs = awardReceipt.logs.map(log => { try { return prizeStrategy.interface.parseLog(log) } catch (e) { return null }})
  
  console.log({ awardLogs })
  console.log({ strategyLogs })

  const awarded = awardLogs.find(event => event && event.name === 'Awarded')

  console.log(`Awarded ${ethers.utils.formatEther(awarded.args.amount)} Dai`)

}

run()
