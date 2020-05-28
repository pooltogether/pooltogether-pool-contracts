const { expect } = require('chai')
const { ethers } = require('./helpers/ethers')
const { increaseTime } = require('./helpers/increaseTime')
const buidler = require('./helpers/buidler')
const { deployContracts } = require('../js/deployContracts')
const {
  SPONSORSHIP_INTERFACE_HASH,
  TIMELOCK_INTERFACE_HASH,
  TICKET_INTERFACE_HASH,
  YIELD_SERVICE_INTERFACE_HASH,
  PRIZE_POOL_INTERFACE_HASH
} = require('../js/constants')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:PeriodicPrizePool.test')

async function prizePoolCurrentPrize(prizePoolContract) {
  let fxn = prizePoolContract.interface.functions.currentPrize
  let data = fxn.encode([])
  let result = await prizePoolContract.provider.call({ to: prizePoolContract.address, data })
  return fxn.decode(result)[0]
}

async function prizePoolEstimatePrize(prizePoolContract, secondsPerBlock) {
  let fxn = prizePoolContract.interface.functions.estimatePrizeWithBlockTime
  let data = fxn.encode([secondsPerBlock])
  let result = await prizePoolContract.provider.call({ to: prizePoolContract.address, data })
  return fxn.decode(result)[0]
}

async function getEvents(contract, txHash) {
  let provider = contract.provider
  let tx = await provider.getTransactionReceipt(txHash)
  let filter = { blockHash: tx.blockHash }
  let logs = await provider.getLogs(filter)
  let parsedLogs = logs.map((log) => contract.interface.parseLog(log))
  return parsedLogs
}

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('PeriodicPrizePool contract', () => {
  
  let env

  let wallet

  let prizePool
  let token
  let ticket
  let timelock
  let sponsorship
  let yieldService

  let prizePeriodSeconds

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()

    prizePeriodSeconds = 10
    
    ethers.errors.setLogLevel('error')

    env = await deployContracts(wallet)
    token = env.token
    
    let tx = await env.singleRandomWinnerPrizePoolBuilder.createSingleRandomWinnerPrizePool(env.cToken.address, 10, 'Ticket', 'TICK', 'Sponsorship', 'SPON')
    let events = await getEvents(env.prizePoolBuilder, tx.hash)
    let prizePoolCreatedEvent = events.find(event => event && event.name == 'PrizePoolCreated')
    
    let moduleManager = prizePoolCreatedEvent.values.moduleManager

    prizePool = await buidler.ethers.getContractAt('PeriodicPrizePool', await env.registry.getInterfaceImplementer(moduleManager, PRIZE_POOL_INTERFACE_HASH), wallet)
    ticket = await buidler.ethers.getContractAt('Ticket', await env.registry.getInterfaceImplementer(moduleManager, TICKET_INTERFACE_HASH), wallet)
    yieldService = await buidler.ethers.getContractAt('CompoundYieldService', await env.registry.getInterfaceImplementer(moduleManager, YIELD_SERVICE_INTERFACE_HASH), wallet)

    timelock = await buidler.ethers.getContractAt('Timelock', await env.registry.getInterfaceImplementer(moduleManager, TIMELOCK_INTERFACE_HASH), wallet)
    sponsorship = await buidler.ethers.getContractAt('Sponsorship', await env.registry.getInterfaceImplementer(moduleManager, SPONSORSHIP_INTERFACE_HASH), wallet)

    await increaseTime(10)
    await prizePool.startAward()
    await prizePool.completeAward()

    await token.mint(wallet._address, toWei('10'))
  })

  describe('initialize()', () => {
    it('should set all the vars', async () => {
      expect(await prizePool.prizePeriodSeconds()).to.equal(prizePeriodSeconds)
    })
  })

  describe('currentPrize()', () => {
    it('should return the available interest from the prize pool', async () => {
      await token.approve(ticket.address, toWei('10'))
      await ticket.mintTickets(toWei('10'), [])
      await env.cToken.accrueCustom(toWei('100'))
      expect(await prizePoolCurrentPrize(prizePool)).to.equal(toWei('100'))
    })
  })

  describe('sweepTimelock()', () => {
    it('should return any timelocked funds that are now open', async () => {
      debug('minting tickets...')
      // deposit
      await token.approve(ticket.address, toWei('4'))
      await ticket.mintTickets(toWei('4'), [])

      let userBalance = await token.balanceOf(wallet._address)

      debug('redeem with timelock...')

      await ticket.redeemTicketsWithTimelock(toWei('4'), [])

      let availAt = await timelock.balanceAvailableAt(wallet._address)
      let startTime = await prizePool.prizePeriodStartedAt()

      expect(availAt.eq(startTime.add(10))).to.be.true

      // now progress time
      await increaseTime(10)

      debug('sweeping funds...')

      await timelock.sweep([wallet._address])

      expect(await timelock.balanceOf(wallet._address)).to.equal(toWei('0'))      

      expect((await token.balanceOf(wallet._address)).sub(userBalance)).to.equal(toWei('4'))
    })
  })

  describe('multiplyByRemainingTimeFraction()', () => {
    it('should calculate as a fraction of the time remaining', async () => {
      let remainingSeconds = (await prizePool.prizePeriodRemainingSeconds()).toNumber()

      expect(await prizePool.multiplyByRemainingTimeFraction(toWei('1'))).to.equal(toWei('' + (remainingSeconds / prizePeriodSeconds)))

      // increment 4
      await increaseTime(4)

      remainingSeconds = (await prizePool.prizePeriodRemainingSeconds()).toNumber()
      
      expect(await prizePool.multiplyByRemainingTimeFraction(toWei('1'))).to.equal(toWei('' + (remainingSeconds / prizePeriodSeconds)))
    })
  })

  describe('prizePeriodEndAt()', () => {
    it('should be correct', async () => {
      let start = (await prizePool.prizePeriodStartedAt()).toNumber()
      expect(await prizePool.prizePeriodEndAt()).to.equal(start + 10)
    })
  })

  describe('calculateExitFee(address, uint256 tickets)', () => {
    it('should calculate', async () => {
      // create tickets
      await token.approve(ticket.address, toWei('10'))
      await ticket.mintTickets(toWei('10'), [])

      // create a prize
      await env.cToken.accrueCustom(toWei('1'))
      
      debug('increasing time...')

      await increaseTime(11)
      
      expect(await sponsorship.totalSupply()).to.equal(toWei('0'))

      // award the prize.  will be 1 new ticket
      await prizePool.startAward()
      await prizePool.completeAward()

      debug('checking total sponsorship supply...')

      // Should be the winnings
      expect(await sponsorship.totalSupply()).to.equal(toWei('1'))
      expect(await prizePool.previousPrize()).to.equal(toWei('1'))

      debug('calculating exit fee...')

      // now post-prize we want to check the fee.  There are now 11 tickets.
      let exitFee = await prizePool.calculateExitFee(wallet._address, toWei('11'))
      
      debug('calculating seconds...')

      let remainingSeconds = (await prizePool.prizePeriodRemainingSeconds()).toNumber()
      let secs = (remainingSeconds / (prizePeriodSeconds*1.0))

      debug({ remainingSeconds, secs })

      // console.log({secs})
      expect(exitFee).to.equal(toWei('' + secs))
    })
  })

  describe('calculateUnlockTimestamp(address, uint256)', () => {
    it('should calculate the prize period end', async () => {
      let start = (await prizePool.prizePeriodStartedAt()).toNumber()
      expect(await prizePool.calculateUnlockTimestamp(wallet._address, '0')).to.equal(start + 10)
    })
  })

  describe('estimatePrize()', () => {
    it('should calculate the prize', async () => {
      await token.approve(ticket.address, toWei('10'))
      await ticket.mintTickets(toWei('10'), [])

      // supply rate is 0.01 
      // remaining time is 10 seconds
      // block time is 1 seconds (passed in)
      // total rate is estimated to be 10 * 0.01 = 0.1
      // total = 10 * 0.1 = 1

      let remainingSeconds = await prizePool.prizePeriodRemainingSeconds()

      // seconds per block is one, so there are remainingSeconds blocks left.
      // remainingSeconds * 0.01 == remainingSeconds / 100
      // current accounted balance is toWei('10')
      let estimate = remainingSeconds.mul(toWei('10')).div(100)

      // should be current prize + estimated remaining
      expect(await prizePoolEstimatePrize(prizePool, toWei('1'))).to.equal(estimate)
    })
  })

  describe('startAward()', () => {
    it('should not be called before the prize period is over', async () => {
      await expect(prizePool.startAward()).to.be.revertedWith('prize period not over')
    })

    it('should succeed without a winner', async () => {
      await increaseTime(11)
      await prizePool.startAward()
      await prizePool.completeAward()
      let block = await buidler.ethers.provider.getBlock('latest')
      // new prize period end block
      expect(await prizePool.prizePeriodEndAt()).to.equal(block.timestamp + 10)
    })

    it('should draw a winner and allocate prize', async () => {
      // ensure the wallet can be selected by depositing
      await token.approve(ticket.address, toWei('10'))
      await ticket.mintTickets(toWei('10'), [])

      await env.cToken.accrueCustom(toWei('10'))

      await increaseTime(11)
      await prizePool.startAward()
      await prizePool.completeAward()
      let block = await buidler.ethers.provider.getBlock('latest')

      // should allocate the prize
      expect(await ticket.balanceOf(wallet._address)).to.equal(toWei('20'))
      
      // new prize period end block
      expect(await prizePool.prizePeriodEndAt()).to.equal(block.timestamp + 10)
    })
  })
})
