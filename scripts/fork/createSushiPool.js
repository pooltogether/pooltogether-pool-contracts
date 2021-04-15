const hardhat = require('hardhat')
const chalk = require("chalk")
const { increaseTime } = require('../../test/helpers/increaseTime')
const { SUSHI_HOLDER } = require('./constants')

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}

const { ethers, deployments, getNamedAccounts } = hardhat

const toWei = ethers.utils.parseEther

async function getYieldSourcePrizePoolProxy(tx) { 
  const stakePrizePoolProxyFactory = await ethers.getContract('YieldSourcePrizePoolProxyFactory')
  const createResultReceipt = await ethers.provider.getTransactionReceipt(tx.hash)
  const createResultEvents = createResultReceipt.logs.map(log => { try { return stakePrizePoolProxyFactory.interface.parseLog(log) } catch (e) { return null } })
  const address = createResultEvents[0].args.proxy
  dim(`Found pool address at ${address}`)
  return address
}

async function run() {
  const sushiHolder = await ethers.provider.getUncheckedSigner(SUSHI_HOLDER)
  const sushi = await ethers.getContractAt('IERC20Upgradeable', '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2', sushiHolder)
  const builder = await ethers.getContract('PoolWithMultipleWinnersBuilder', sushiHolder)

  const sushiYieldSourceAddress = '0xB2Ad5F4277fcaBd1CADe34317db8c5Ba478aDDAd'
  const sushiYieldSource = await ethers.getContractAt('IYieldSource', sushiYieldSourceAddress, sushiHolder)

  const block = await ethers.provider.getBlock()

  const yieldSourcePrizePoolConfig = {
    yieldSource: sushiYieldSourceAddress,
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
    ticketCreditLimitMantissa: ethers.utils.parseEther('0.1'),
    ticketCreditRateMantissa: '166666666666666',
    numberOfWinners: 1,
    splitExternalErc20Awards: false
  }

  const tx = await builder.createYieldSourceMultipleWinners(
    yieldSourcePrizePoolConfig,
    multipleWinnersConfig,
    18
  )

  const prizePool = await ethers.getContractAt('YieldSourcePrizePool', await getYieldSourcePrizePoolProxy(tx), sushiHolder)

  green(`Created YieldSourcePrizePool ${prizePool.address}`)

  const prizeStrategy = await ethers.getContractAt('MultipleWinners', await prizePool.prizeStrategy(), sushiHolder)
  const ticketAddress = await prizeStrategy.ticket()
  const ticket = await ethers.getContractAt('Ticket', ticketAddress, sushiHolder)

  const depositAmount = toWei('1000')

  let sushiBalance = await sushi.balanceOf(sushiHolder._address)
  green(`Sushi Holder starting Sushi balance: ${ethers.utils.formatEther(sushiBalance)}`)

  dim(`Approving Sushi spend for ${sushiHolder._address}...`)
  await sushi.approve(prizePool.address, depositAmount)
  dim(`Depositing into Pool with ${sushiHolder._address}, ${ethers.utils.formatEther(depositAmount)}, ${ticketAddress} ${ethers.constants.AddressZero}...`)
  await prizePool.depositTo(sushiHolder._address, depositAmount, ticketAddress, ethers.constants.AddressZero)
  dim(`Prize Pool sushi balance: ${ethers.utils.formatEther(await sushiYieldSource.callStatic.balanceOfToken(prizePool.address))}`)
  dim(`Withdrawing...`)
  const sushiBalanceBeforeWithdrawal = await sushi.balanceOf(sushiHolder._address)
  await prizePool.withdrawInstantlyFrom(sushiHolder._address, depositAmount, ticketAddress, depositAmount)
  const sushiDiffAfterWithdrawal = (await sushi.balanceOf(sushiHolder._address)).sub(sushiBalanceBeforeWithdrawal)
  dim(`Withdrew ${ethers.utils.formatEther(sushiDiffAfterWithdrawal)} sushi`)

  dim(`Prize Pool sushi balance: ${ethers.utils.formatEther(await sushiYieldSource.callStatic.balanceOfToken(prizePool.address))}`)

  // now there should be some prize
  await prizePool.captureAwardBalance()
  console.log(`Prize is now: ${ethers.utils.formatEther(await prizePool.awardBalance())} Sushi`)

  await sushi.approve(prizePool.address, sushiDiffAfterWithdrawal)
  await prizePool.depositTo(sushiHolder._address, sushiDiffAfterWithdrawal, await prizeStrategy.ticket(), ethers.constants.AddressZero)

  let ticketBalance = await ticket.balanceOf(sushiHolder._address)

  green(`New ticket balance: ${ethers.utils.formatEther(ticketBalance)}`)

  dim(`Starting award...`)
  await prizeStrategy.startAward()
  await increaseTime(1)
  dim(`Completing award...`)
  const awardTx = await prizeStrategy.completeAward()
  const awardReceipt = await ethers.provider.getTransactionReceipt(awardTx.hash)
  const awardLogs = awardReceipt.logs.map(log => { try { return prizePool.interface.parseLog(log) } catch (e) { return null }})
  const awarded = awardLogs.find(event => event && event.name === 'Awarded')

  if (awarded) {
    console.log(`Awarded ${ethers.utils.formatEther(awarded.args.amount)} Sushi`)
  } else {
    console.log(`No prizes`)
  }

  sushiBalance = await sushi.balanceOf(sushiHolder._address)
  ticketBalance = await ticket.balanceOf(sushiHolder._address)
  green(`New ticket balance is ${ethers.utils.formatEther(ticketBalance)}`)

  await increaseTime(1000)

  await prizePool.withdrawInstantlyFrom(sushiHolder._address, ticketBalance, ticketAddress, ticketBalance)
  
  const sushiDiff = (await sushi.balanceOf(sushiHolder._address)).sub(sushiBalance)
  dim(`Amount withdrawn is ${ethers.utils.formatEther(sushiDiff)}`)

}

run()
