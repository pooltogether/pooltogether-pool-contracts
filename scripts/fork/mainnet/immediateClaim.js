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
  const operationsSafe = await ethers.provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')
  const daiRichSigner = await ethers.provider.getUncheckedSigner('0xF977814e90dA44bFA03b6295A0616a897441aceC')
  const daiTicket = await ethers.getContractAt('Ticket', '0x334cbb5858417aee161b53ee0d5349ccf54514cf', operationsSafe)
  const dai = await ethers.getContractAt('Dai', '0x6b175474e89094c44da98b954eedeac495271d0f', operationsSafe)
  const daiPrizePool = await ethers.getContractAt('CompoundPrizePool', '0xEBfb47A7ad0FD6e57323C8A42B2E5A6a4F68fc1a', operationsSafe)
  const daiFaucet = await ethers.getContractAt('TokenFaucet', '0xF362ce295F2A4eaE4348fFC8cDBCe8d729ccb8Eb', operationsSafe)

  /// 30m
  const amount = ethers.utils.parseEther('30000000')

  const balance = await dai.balanceOf(daiRichSigner._address)
  console.log(`Dai Balance: ${ethers.utils.formatEther(balance)}`)
  // transfer to operationsSafe
  await dai.connect(daiRichSigner).transfer(operationsSafe._address, balance)

  await dai.approve(daiPrizePool.address, amount)
  
  console.log(`Depositing ${ethers.utils.formatEther(amount)} Dai...`);
  
  await daiPrizePool.depositTo(operationsSafe._address, amount, daiTicket.address, ethers.constants.AddressZero)

  let claimAmount = await daiFaucet.callStatic.claim(operationsSafe._address)
  console.log(`claim amount: ${ethers.utils.formatEther(claimAmount)}`)

  await increaseTime(7 * 24 * 3600) // one week

  claimAmount = await daiFaucet.callStatic.claim(operationsSafe._address)
  console.log(`claim amount after one week: ${ethers.utils.formatEther(claimAmount)}`)
}

run()
