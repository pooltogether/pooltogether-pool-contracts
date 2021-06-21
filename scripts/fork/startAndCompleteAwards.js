const hardhat = require('hardhat')
const chalk = require("chalk")
const { increaseTime } = require('../../test/helpers/increaseTime')

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function yellow() {
  console.log(chalk.yellow.call(chalk, ...arguments))
}

async function run() {
  const { ethers } = hardhat
  const { provider } = ethers

  const DAI_PRIZE_POOL = '0xEBfb47A7ad0FD6e57323C8A42B2E5A6a4F68fc1a'
  const USDC_PRIZE_POOL = '0x0650d780292142835F6ac58dd8E2a336e87b4393'
  
  const governance = await ethers.provider.getUncheckedSigner('0x42cd8312D2BCe04277dD5161832460e95b24262E')
  const prizePool = await ethers.getContractAt('CompoundPrizePool', USDC_PRIZE_POOL, governance)

  const prizeStrategy = await ethers.getContractAt('MultipleWinners', await prizePool.prizeStrategy(), governance)

  if(await prizeStrategy.rng() != '0xb1D89477d1b505C261bab6e73f08fA834544CD21') {
    dim(`Swapping RNG with blockhash on ${prizeStrategy.address}...`)
    await prizeStrategy.setRngService('0xb1D89477d1b505C261bab6e73f08fA834544CD21')
  }

  if (await prizeStrategy.isRngTimedOut()) {
    const prizePeriodSeconds = await prizeStrategy.prizePeriodSeconds()
    await increaseTime(prizePeriodSeconds.toNumber())
    dim(`cancelling award`)
    await prizeStrategy.cancelAward()
  }

  dim(`Setting split external to true...`)
  await prizeStrategy.setSplitExternalErc20Awards(true)

  const remainingTime = await prizeStrategy.prizePeriodRemainingSeconds()
  dim(`Increasing time by ${remainingTime} seconds...`)
  await increaseTime(remainingTime.toNumber())

  // if we cannot complete, let's startt it
  if (await prizeStrategy.canStartAward()) {
    const numberOfWinners = 10
    dim(`Setting number of winners to ${numberOfWinners}`)
    await prizeStrategy.setNumberOfWinners(numberOfWinners)

    dim(`Starting award...`)
    await prizeStrategy.startAward()
    await increaseTime(1)
    await increaseTime(1)
  }

  if (await prizeStrategy.canCompleteAward()) {
    yellow(`Completing award... (will probably fail the first time on a fresh fork)....`)
    const completeAwardTx = await prizeStrategy.completeAward()
    const completeAwardReceipt = await provider.getTransactionReceipt(completeAwardTx.hash)
    dim(`Gas used to completeAward: ${completeAwardReceipt.gasUsed.toString()}`)
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
