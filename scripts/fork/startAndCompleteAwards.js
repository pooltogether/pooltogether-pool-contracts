const hardhat = require('hardhat')
const chalk = require("chalk")
const { increaseTime } = require('../test/helpers/increaseTime')

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function yellow() {
  console.log(chalk.yellow.call(chalk, ...arguments))
}

async function run() {
  const { ethers } = hardhat
  const { provider } = ethers

  const gnosisSafe = await ethers.provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')
  const prizePool = await ethers.getContractAt('CompoundPrizePool', '0xEBfb47A7ad0FD6e57323C8A42B2E5A6a4F68fc1a', gnosisSafe)

  const prizeStrategy = await ethers.getContractAt('PeriodicPrizeStrategy', await prizePool.prizeStrategy(), gnosisSafe)

  if(await prizeStrategy.rng() != '0xb1D89477d1b505C261bab6e73f08fA834544CD21') {
    dim(`Swapping RNG with blockhash on ${prizeStrategy.address}...`)
    await prizeStrategy.setRngService('0xb1D89477d1b505C261bab6e73f08fA834544CD21')
  }

  const remainingTime = await prizeStrategy.prizePeriodRemainingSeconds()
  dim(`Increasing time by ${remainingTime} seconds...`)
  await increaseTime(remainingTime.toNumber())

  // if we cannot complete, let's startt it
  if (await prizeStrategy.canStartAward()) {
    dim(`Starting award...`)
    await prizeStrategy.startAward()
    await increaseTime(1)
    await increaseTime(1)
  }

  if (await prizeStrategy.canCompleteAward()) {
    dim(`Completing award (will probably fail the first time on a fresh fork)....`)
    const completeAwardTx = await prizeStrategy.completeAward()
    const completeAwardReceipt = await provider.getTransactionReceipt(completeAwardTx.hash)
    const completeAwardEvents = completeAwardReceipt.logs.reduce((array, log) => { try { array.push(prizePool.interface.parseLog(log)) } catch (e) {} return array }, [])
    const awardedEvents = completeAwardEvents.filter(event => event.name === 'Awarded')
    const awardedExternalERC721Events = completeAwardEvents.filter(event => event.name === 'AwardedExternalERC721')
    const awardedExternalERC20Events = completeAwardEvents.filter(event => event.name === 'AwardedExternalERC20')
  
    const winners = new Set()
  
    awardedEvents.forEach(event => {
      console.log(`Awarded ${ethers.utils.formatEther(event.args.amount)} of token ${event.args.token} to ${event.args.winner}`)
      winners.add(event.args.winner)
    })
  
    awardedExternalERC20Events.forEach(event => {
      console.log(`Awarded ${ethers.utils.formatEther(event.args.amount)} of token ${event.args.token} to ${event.args.winner}`)
      winners.add(event.args.winner)
    })
  
    awardedExternalERC721Events.forEach(event => {
      console.log(`Awarded external erc721 ${event.args.token} token ids ${event.args.tokenIds.join(', ')} to ${event.args.winner}`)
      winners.add(event.args.winner)
    })
  }
}

run()
