const hardhat = require('hardhat')
const chalk = require("chalk")
const { increaseTime } = require('../../../test/helpers/increaseTime')

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}

const { ethers } = hardhat

async function runPoolDepositAndWithdraw (prizePool, signer) {

  const token = await ethers.getContractAt('ERC20Upgradeable', await prizePool.token(), signer)
  const decimals = await token.decimals()
  const prizeStrategy = await ethers.getContractAt('MultipleWinners', await prizePool.prizeStrategy(), signer)
  const ticketAddress = await prizeStrategy.ticket()
  const ticket = await ethers.getContractAt('Ticket', ticketAddress, signer)

  const depositAmount = ethers.utils.parseUnits('1000', decimals)

  let tokenBalance = await token.balanceOf(signer._address)
  green(`token Holder starting token balance: ${ethers.utils.formatUnits(tokenBalance, decimals)}`)

  if (tokenBalance.lt(depositAmount)) {
    throw new Error('Signer has insufficient tokens')
  }

  dim(`Approving token spend for ${signer._address}...`)
  await token.approve(prizePool.address, depositAmount)
  dim(`Allowance ${await token.allowance(signer._address, prizePool.address)}`)

  dim(`Depositing into Pool with ${signer._address}, ${ethers.utils.formatUnits(depositAmount, decimals)}, ${ticketAddress} ${ethers.constants.AddressZero}...`)
  await prizePool.depositTo(signer._address, depositAmount, ticketAddress, ethers.constants.AddressZero)
  
  dim(`Withdrawing...`)
  const tokenBalanceBeforeWithdrawal = await token.balanceOf(signer._address)
  await prizePool.withdrawInstantlyFrom(signer._address, depositAmount, ticketAddress, depositAmount)
  const tokenDiffAfterWithdrawal = (await token.balanceOf(signer._address)).sub(tokenBalanceBeforeWithdrawal)
  dim(`Withdrew ${ethers.utils.formatUnits(tokenDiffAfterWithdrawal, decimals)} token`)

  // now there should be some prize
  await prizePool.captureAwardBalance()
  console.log(`Prize is now: ${ethers.utils.formatUnits(await prizePool.awardBalance(), decimals)} token`)

  await token.approve(prizePool.address, tokenDiffAfterWithdrawal)
  await prizePool.depositTo(signer._address, tokenDiffAfterWithdrawal, await prizeStrategy.ticket(), ethers.constants.AddressZero)

  let ticketBalance = await ticket.balanceOf(signer._address)

  green(`New ticket balance: ${ethers.utils.formatUnits(ticketBalance, decimals)}`)
}

module.exports = {
  runPoolDepositAndWithdraw
}