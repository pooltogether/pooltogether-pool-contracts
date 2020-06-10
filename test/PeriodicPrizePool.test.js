const { deployContract, deployMockContract } = require('ethereum-waffle')
const { deploy1820 } = require('deploy-eip-1820')
const { expect } = require('chai')
const { ethers } = require('./helpers/ethers')
const { increaseTime } = require('./helpers/increaseTime')
const { call } = require('./helpers/call')
const buidler = require('./helpers/buidler')

const PrizePoolModuleManager = require('../build/PrizePoolModuleManager.json')
const PeriodicPrizePoolHarness = require('../build/PeriodicPrizePoolHarness.json')
const InterestTracker = require('../build/InterestTracker.json')
const CompoundYieldService = require('../build/CompoundYieldService.json')
const Sponsorship = require('../build/Sponsorship.json')
const Ticket = require('../build/Ticket.json')
const PrizeStrategyInterface = require('../build/PrizeStrategyInterface.json')
const RNGInterface = require('../build/RNGInterface.json')
const GovernorInterface = require('../build/GovernorInterface.json')

const {
  PRIZE_POOL_INTERFACE_HASH
} = require('../js/constants')

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const toWei = ethers.utils.parseEther
const FORWARDER = '0x5f48a3371df0F8077EC741Cc2eB31c84a4Ce332a'
const debug = require('debug')('ptv3:PeriodicPrizePool.test')
const overrides = { gasLimit: 40000000 }

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
  let strategy
  let rng, governor

  let prizePeriodSeconds

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()

    prizePeriodSeconds = 10
    
    ethers.errors.setLogLevel('error')

    await deploy1820(wallet)

    manager = await deployMockContract(wallet, PrizePoolModuleManager.abi, overrides)
    yieldService = await deployMockContract(wallet, CompoundYieldService.abi, overrides)
    sponsorship = await deployMockContract(wallet, Sponsorship.abi, overrides)
    interestTracker = await deployMockContract(wallet, InterestTracker.abi, overrides)
    ticket = await deployMockContract(wallet, Ticket.abi, overrides)
    rng = await deployMockContract(wallet, RNGInterface.abi, overrides)
    governor = await deployMockContract(wallet, GovernorInterface.abi, overrides)

    await manager.mock.yieldService.returns(yieldService.address)
    await manager.mock.sponsorship.returns(sponsorship.address)
    await manager.mock.interestTracker.returns(interestTracker.address)
    await manager.mock.ticket.returns(ticket.address)

    await manager.mock.enableModuleInterface.withArgs(PRIZE_POOL_INTERFACE_HASH).returns()
    await manager.mock.isModuleEnabled.withArgs(wallet._address).returns(true)

    strategy = await deployMockContract(wallet, PrizeStrategyInterface.abi, overrides)
    
    prizePool = await deployContract(wallet, PeriodicPrizePoolHarness, [], overrides)

    await prizePool.initialize(
      manager.address,
      FORWARDER,
      governor.address,
      strategy.address,
      rng.address,
      prizePeriodSeconds
    )
  })

  describe('initialize()', () => {
    it('should set all the vars', async () => {
      expect(await prizePool.prizePeriodSeconds()).to.equal(prizePeriodSeconds)
    })
  })

  describe('currentPrize()', () => {
    it('should return the available interest from the prize pool', async () => {
      await governor.mock.reserve.returns(ZERO_ADDRESS)
      await yieldService.mock.unaccountedBalance.returns(toWei('10'))

      expect(await prizePoolCurrentPrize(prizePool)).to.equal(toWei('10'))
    })

    it('should return the interest less the reserve fee when non-zero', async () => {
      await governor.mock.reserve.returns(FORWARDER)
      await governor.mock.reserveFeeMantissa.returns(toWei('0.1'))
      await yieldService.mock.unaccountedBalance.returns(toWei('10'))

      expect(await prizePoolCurrentPrize(prizePool)).to.equal(toWei('9'))
    })
  })

  describe('calculateExitFeeWithValues()', () => {
    it('should maximize the fee when the user has half the total tickets', async () => {

      // ticket ratio: 0.1
      // user ratio: 0.01
      
      // => user has contributed 100 * 0.01 = 1
      // => user should have contributed 100 * 0.1 = 10
      // => user should have contributed 100 * 0.09 = 9 

      expect(await prizePool.calculateExitFeeWithValues(
        toWei('0.01'),
        toWei('100'),
        toWei('100'),
        toWei('10')
      )).to.equal(toWei('9'))
    })

    it('should have a zero fee when there was no prize', async () => {
      expect(await prizePool.calculateExitFeeWithValues(
        toWei('0'),
        toWei('1000'),
        toWei('10000'),
        toWei('0')
      )).to.equal(toWei('0'))
    })

    it('should have a zero fee when there were no tickets', async () => {
      expect(await prizePool.calculateExitFeeWithValues(
        toWei('0'),
        toWei('1000'),
        toWei('0'),
        toWei('100')
      )).to.equal(toWei('0'))
    })

    it('should be zero when the user has a higher collateralization', async () => {
      expect(await prizePool.calculateExitFeeWithValues(
        toWei('0.1'),
        toWei('1000'),
        toWei('1000'),
        toWei('10')
      )).to.equal(toWei('0'))
    })
  })

  describe('prizePeriodEndAt()', () => {
    it('should be correct', async () => {
      let start = (await prizePool.prizePeriodStartedAt()).toNumber()
      expect(await prizePool.prizePeriodEndAt()).to.equal(start + 10)
    })
  })

  describe('calculateExitFee(address user, uint256 tickets)', () => {
    it('should calculate the fee as a fraction of time remaining', async () => {

      // user has no interest
      await interestTracker.mock.interestRatioMantissa.withArgs(wallet._address).returns('0')

      await prizePool.setPreviousPrizeAverageTickets(toWei('100'))
      await prizePool.setPreviousPrize(toWei('10'))

      // check remaining seconds
      let remainingSeconds = (await prizePool.prizePeriodRemainingSeconds()).toNumber()
      let fraction = remainingSeconds / (prizePeriodSeconds * 1.0)
      expect(await prizePool.calculateExitFee(wallet._address, toWei('50'))).to.equal(toWei('' + (5 * fraction)))
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
      // here we've accrued 100
      await yieldService.mock.unaccountedBalance.returns(toWei('100'))
      // there are 1000 tickets left
      await yieldService.mock.accountedBalance.returns(toWei('1000'))

      // Governor reserve is active
      await governor.mock.reserve.returns(FORWARDER)
      // reserve is 10%
      await governor.mock.reserveFeeMantissa.returns(toWei('0.1'))

      // get remaining blocks
      let remainingBlocks = await prizePool.estimateRemainingBlocksToPrize(toWei('13.4'))

      await yieldService.mock.estimateAccruedInterestOverBlocks.withArgs(toWei('1000'), remainingBlocks).returns(toWei('10'))

      // should be current prize + estimated remaining less the reserve fee
      expect(await call(prizePool, 'estimatePrize')).to.equal(toWei('99'))
    })
  })

  describe('estimateRemainingPrize()', () => {
    it('should use the default block size', async () => {
      // there are 1000 tickets left
      await yieldService.mock.accountedBalance.returns(toWei('1000'))

      // Governor reserve is active
      await governor.mock.reserve.returns(FORWARDER)
      // reserve is 10%
      await governor.mock.reserveFeeMantissa.returns(toWei('0.1'))

      // get remaining blocks
      let remainingBlocks = await prizePool.estimateRemainingBlocksToPrize(toWei('13.4'))

      await yieldService.mock.estimateAccruedInterestOverBlocks.withArgs(toWei('1000'), remainingBlocks).returns(toWei('10'))

      // should be current prize + estimated remaining less the reserve fee
      expect(await call(prizePool, 'estimateRemainingPrize')).to.equal(toWei('9'))
    })
  })  

  describe('startAward()', () => {
    it('should not be called before the prize period is over', async () => {
      await expect(prizePool.startAward()).to.be.revertedWith('prize period not over')
    })

    it('should request a random number', async () => {
      await increaseTime(11)
      await rng.mock.requestRandomNumber.returns('42')
      await prizePool.startAward()
      expect(await prizePool.rngRequestId()).to.equal('42')
    })

    it('cannot be restarted', async () => {
      await increaseTime(11)
      await rng.mock.requestRandomNumber.returns('42')
      await prizePool.startAward()
      await expect(prizePool.startAward()).to.be.revertedWith('rng has already been requested')
    })
  })

  describe('completeAward()', () => {
    it('cannot be called unless the award has started', async () => {
      await expect(prizePool.completeAward()).to.be.revertedWith('no rng request has been made')
    })

    it('cannot be called unless the rng has completed', async () => {
      await increaseTime(11)
      await rng.mock.requestRandomNumber.returns('42')
      await prizePool.startAward()
      await rng.mock.isRequestComplete.withArgs('42').returns(false)
      await expect(prizePool.completeAward()).to.be.revertedWith('rng request has not completed')
    })

    it('should draw a winner and allocate prize', async () => {
      // no reserve
      await governor.mock.reserve.returns(ZERO_ADDRESS)
      
      // start award
      await increaseTime(11)
      await rng.mock.requestRandomNumber.returns('42')
      await prizePool.startAward()

      let random = '0x0000000000000000000000000000000000000000000000000000000000000001'

      // setup rng
      await rng.mock.isRequestComplete.withArgs('42').returns(true)
      await rng.mock.randomNumber.withArgs('42').returns(random)

      // setup winnings
      await yieldService.mock.unaccountedBalance.returns(toWei('100'))

      // setup the capture and sponsorship mint
      await yieldService.mock.capture.withArgs(toWei('100')).returns()
      await sponsorship.mock.mint.withArgs(strategy.address, toWei('100')).returns()
      await interestTracker.mock.accrueInterest.withArgs(toWei('100')).returns()

      // expect strategy
      await strategy.mock.award.withArgs(random, toWei('100')).returns()

      await ticket.mock.totalSupply.returns(toWei('1000'))

      await prizePool.completeAward()

      expect(await prizePool.previousPrize()).to.equal(toWei('100'))
      expect(await prizePool.previousPrizeAverageTickets()).to.equal(toWei('1000'))
      expect(await prizePool.rngRequestId()).to.equal('0')
    })
  })
})
