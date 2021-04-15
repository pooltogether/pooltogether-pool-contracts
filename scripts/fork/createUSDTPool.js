const hardhat = require('hardhat')
const chalk = require("chalk")
const { increaseTime } = require('../../test/helpers/increaseTime')
const { USDT_HOLDER } = require('./constants')

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}

const { ethers } = hardhat

async function getCompoundPrizePoolProxy(tx) { 
  const compoundPrizePoolProxyFactory = await ethers.getContract('CompoundPrizePoolProxyFactory')
  const createResultReceipt = await ethers.provider.getTransactionReceipt(tx.hash)
  const createResultEvents = createResultReceipt.logs.map(log => { try { return compoundPrizePoolProxyFactory.interface.parseLog(log) } catch (e) { return null } })
  const address = createResultEvents[0].args.proxy
  dim(`Found pool address at ${address}`)
  return address
}

async function run() {
  const usdtHolder = await ethers.provider.getUncheckedSigner(USDT_HOLDER)
  const usdt = await ethers.getContractAt('IERC20Upgradeable', '0xdAC17F958D2ee523a2206206994597C13D831ec7', usdtHolder)
  const builder = await ethers.getContract('PoolWithMultipleWinnersBuilder', usdtHolder)

  dim(`Using PoolWithMultipleWinnersBuilder @ ${builder.address}`)

  const cUSDT = '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9'

  const block = await ethers.provider.getBlock()

  const compoundPrizePoolConfig = {
    cToken: cUSDT,
    maxExitFeeMantissa: ethers.utils.parseEther('0.1').toString(),
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

  dim(`Creating Compound Prize Pool...`)

  const tx = await builder.createCompoundMultipleWinners(
    compoundPrizePoolConfig,
    multipleWinnersConfig,
    18
  )

  green(`Created Compound Prize Pool`)

  const prizePool = await ethers.getContractAt('CompoundPrizePool', await getCompoundPrizePoolProxy(tx), usdtHolder)

  green(`Created CompoundPrizePool ${prizePool.address}`)

  const prizeStrategy = await ethers.getContractAt('MultipleWinners', await prizePool.prizeStrategy(), usdtHolder)
  const ticketAddress = await prizeStrategy.ticket()
  const ticket = await ethers.getContractAt('Ticket', ticketAddress, usdtHolder)

  const depositAmount = ethers.utils.parseUnits('1000', 6)

  let usdtBalance = await usdt.balanceOf(usdtHolder._address)
  green(`USDT Holder starting USDT balance: ${ethers.utils.formatUnits(usdtBalance, 6)}`)

  dim(`Approving USDT spend for ${usdtHolder._address}...`)
  await usdt.approve(prizePool.address, depositAmount)
  dim(`Depositing into Pool with ${usdtHolder._address}, ${ethers.utils.formatUnits(depositAmount, 6)}, ${ticketAddress} ${ethers.constants.AddressZero}...`)
  await prizePool.depositTo(usdtHolder._address, depositAmount, ticketAddress, ethers.constants.AddressZero)
  dim(`Withdrawing...`)
  const usdtBalanceBeforeWithdrawal = await usdt.balanceOf(usdtHolder._address)
  await prizePool.withdrawInstantlyFrom(usdtHolder._address, depositAmount, ticketAddress, depositAmount)
  const usdtDiffAfterWithdrawal = (await usdt.balanceOf(usdtHolder._address)).sub(usdtBalanceBeforeWithdrawal)
  dim(`Withdrew ${ethers.utils.formatUnits(usdtDiffAfterWithdrawal, 6)} usdt`)

  // now there should be some prize
  await prizePool.captureAwardBalance()
  console.log(`Prize is now: ${ethers.utils.formatUnits(await prizePool.awardBalance(), 6)} USDT`)

  await usdt.approve(prizePool.address, usdtDiffAfterWithdrawal)
  await prizePool.depositTo(usdtHolder._address, usdtDiffAfterWithdrawal, await prizeStrategy.ticket(), ethers.constants.AddressZero)

  let ticketBalance = await ticket.balanceOf(usdtHolder._address)

  green(`New ticket balance: ${ethers.utils.formatUnits(ticketBalance, 6)}`)

  dim(`Starting award...`)
  await prizeStrategy.startAward()
  await increaseTime(1)
  dim(`Completing award...`)
  const awardTx = await prizeStrategy.completeAward()
  const awardReceipt = await ethers.provider.getTransactionReceipt(awardTx.hash)
  const awardLogs = awardReceipt.logs.map(log => { try { return prizePool.interface.parseLog(log) } catch (e) { return null }})
  const awarded = awardLogs.find(event => event && event.name === 'Awarded')

  if (awarded) {
    console.log(`Awarded ${ethers.utils.formatUnits(awarded.args.amount, 6)} USDT`)
  } else {
    console.log(`No prizes`)
  }

  usdtBalance = await usdt.balanceOf(usdtHolder._address)
  ticketBalance = await ticket.balanceOf(usdtHolder._address)
  green(`New ticket balance is ${ethers.utils.formatUnits(ticketBalance, 6)}`)

  await increaseTime(1000)

  await prizePool.withdrawInstantlyFrom(usdtHolder._address, ticketBalance, ticketAddress, ticketBalance)
  
  const usdtDiff = (await usdt.balanceOf(usdtHolder._address)).sub(usdtBalance)
  dim(`Amount withdrawn is ${ethers.utils.formatUnits(usdtDiff, 6)}`)

}

run()
