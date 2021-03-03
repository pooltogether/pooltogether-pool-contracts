const { deployments } = require("hardhat");
const { expect } = require('chai')
const hardhat = require('hardhat')
const { ethers } = require('ethers')
const { AddressZero } = ethers.constants
const { getEvents } = require('./helpers/getEvents')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:PoolWithMultipleWinnersBuilder.test.js')

describe('PoolWithMultipleWinnersBuilder', () => {

  let wallet

  let builder

  let compoundPrizePoolProxyFactory,
      stakePrizePoolProxyFactory,
      multipleWinnersBuilder

  let multipleWinnersConfig

  beforeEach(async () => {
    [wallet] = await hardhat.ethers.getSigners()

    await deployments.fixture()
    
    builder = await hardhat.ethers.getContractAt(
      "PoolWithMultipleWinnersBuilder",
      (await deployments.get("PoolWithMultipleWinnersBuilder")).address,
      wallet
    )

    dai = (await deployments.get("Dai"))
    vault = (await deployments.get("yDai"))
    cDaiYieldSource = (await deployments.get("cDaiYieldSource"))
    cToken = (await deployments.get("cDai"))
    rngServiceMock = (await deployments.get("RNGServiceMock"))
    compoundPrizePoolProxyFactory = (await deployments.get("CompoundPrizePoolProxyFactory"))
    stakePrizePoolProxyFactory = (await deployments.get("StakePrizePoolProxyFactory"))
    multipleWinnersBuilder = (await deployments.get("MultipleWinnersBuilder"))

    multipleWinnersConfig = {
      proxyAdmin: AddressZero,
      rngService: rngServiceMock.address,
      prizePeriodStart: 20,
      prizePeriodSeconds: 10,
      ticketName: "Ticket",
      ticketSymbol: "TICK",
      sponsorshipName: "Sponsorship",
      sponsorshipSymbol: "SPON",
      ticketCreditLimitMantissa: toWei('0.1'),
      ticketCreditRateMantissa: toWei('0.001'),
      numberOfWinners: 3
    }
  })

  describe('constructor()', () => {
    it('should setup all factories', async () => {
      expect(await builder.reserveRegistry()).not.to.equal(ethers.constants.AddressZero)
      expect(await builder.compoundPrizePoolProxyFactory()).to.equal(compoundPrizePoolProxyFactory.address)
      expect(await builder.stakePrizePoolProxyFactory()).to.equal(stakePrizePoolProxyFactory.address)
      expect(await builder.multipleWinnersBuilder()).to.equal(multipleWinnersBuilder.address)
    })
  })

  describe('createCompoundMultipleWinners()', () => {
    let compoundPrizePoolConfig

    beforeEach(async () => {
      compoundPrizePoolConfig = {
        cToken: cToken.address,
        maxExitFeeMantissa: toWei('0.5'),
        maxTimelockDuration: 1000
      }
    })

    it('should create a new prize pool and strategy', async () => {
      debug('Creating pool & strategy...')
      let decimals = 9

      let tx = await builder.createCompoundMultipleWinners(
        compoundPrizePoolConfig,
        multipleWinnersConfig,
        decimals
      )

      debug('Getting events...')

      let events = await getEvents(builder, tx)
      let prizePoolCreatedEvent = events.find(e => e.name == 'CompoundPrizePoolWithMultipleWinnersCreated')

      debug(`Creating prize pool using address: ${prizePoolCreatedEvent.args.prizePool}...`)

      const prizePool = await hardhat.ethers.getContractAt('CompoundPrizePoolHarness', prizePoolCreatedEvent.args.prizePool, wallet)
      const prizeStrategy = await hardhat.ethers.getContractAt('MultipleWinners', prizePoolCreatedEvent.args.prizeStrategy, wallet)

      expect(await prizePool.prizeStrategy()).to.equal(prizeStrategy.address)
      expect(await prizePool.owner()).to.equal(wallet.address)
      expect(await prizeStrategy.owner()).to.equal(wallet.address)

      const ticketAddress = await prizeStrategy.ticket()
      expect(await prizePool.creditPlanOf(ticketAddress)).to.deep.equal([
        multipleWinnersConfig.ticketCreditLimitMantissa,
        multipleWinnersConfig.ticketCreditRateMantissa
      ])

      expect(await prizePool.cToken()).to.equal(compoundPrizePoolConfig.cToken)
      expect(await prizePool.maxExitFeeMantissa()).to.equal(compoundPrizePoolConfig.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(compoundPrizePoolConfig.maxTimelockDuration)
      expect(await prizePool.owner()).to.equal(wallet.address)
    })
  })

  describe('createStakeMultipleWinners()', () => {
    let stakePrizePoolConfig

    beforeEach(async () => {
      stakePrizePoolConfig = {
        token: cToken.address,
        maxExitFeeMantissa: toWei('0.5'),
        maxTimelockDuration: 1000
      }
    })

    it('should create a new prize pool and strategy', async () => {
      debug('Creating pool & strategy...')
      let decimals = 9

      let tx = await builder.createStakeMultipleWinners(
        stakePrizePoolConfig,
        multipleWinnersConfig,
        decimals
      )

      debug('Getting events...')

      let events = await getEvents(builder, tx)
      let prizePoolCreatedEvent = events.find(e => e.name == 'StakePrizePoolWithMultipleWinnersCreated')

      debug(`Creating prize pool using address: ${prizePoolCreatedEvent.args.prizePool}...`)

      const prizePool = await hardhat.ethers.getContractAt('StakePrizePool', prizePoolCreatedEvent.args.prizePool, wallet)
      const prizeStrategy = await hardhat.ethers.getContractAt('MultipleWinners', prizePoolCreatedEvent.args.prizeStrategy, wallet)

      expect(await prizePool.prizeStrategy()).to.equal(prizeStrategy.address)
      expect(await prizePool.owner()).to.equal(wallet.address)
      expect(await prizeStrategy.owner()).to.equal(wallet.address)

      expect(await prizePool.token()).to.equal(stakePrizePoolConfig.token)
      expect(await prizePool.maxExitFeeMantissa()).to.equal(stakePrizePoolConfig.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(stakePrizePoolConfig.maxTimelockDuration)
    })
  })

  describe('createYieldSourceMultipleWinners()', () => {
    let yieldSourcePrizePoolConfig

    beforeEach(async () => {
      yieldSourcePrizePoolConfig = {
        yieldSource: cDaiYieldSource.address,
        maxExitFeeMantissa: toWei('0.5'),
        maxTimelockDuration: 1000
      }
    })

    it('should create a new prize pool and strategy', async () => {
      debug('Creating pool & strategy...')
      let decimals = 9

      let tx = await builder.createYieldSourceMultipleWinners(
        yieldSourcePrizePoolConfig,
        multipleWinnersConfig,
        decimals
      )

      debug('Getting events...')

      let events = await getEvents(builder, tx)
      let prizePoolCreatedEvent = events.find(e => e.name == 'YieldSourcePrizePoolWithMultipleWinnersCreated')

      debug(`Creating prize pool using address: ${prizePoolCreatedEvent.args.prizePool}...`)

      const prizePool = await hardhat.ethers.getContractAt('YieldSourcePrizePool', prizePoolCreatedEvent.args.prizePool, wallet)
      const prizeStrategy = await hardhat.ethers.getContractAt('MultipleWinners', prizePoolCreatedEvent.args.prizeStrategy, wallet)

      expect(await prizePool.yieldSource()).to.equal(cDaiYieldSource.address)
      expect(await prizePool.token()).to.equal(dai.address)
      expect(await prizePool.prizeStrategy()).to.equal(prizeStrategy.address)
      expect(await prizePool.owner()).to.equal(wallet.address)
      expect(await prizePool.maxExitFeeMantissa()).to.equal(yieldSourcePrizePoolConfig.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(yieldSourcePrizePoolConfig.maxTimelockDuration)

      expect(await prizeStrategy.owner()).to.equal(wallet.address)
    })
  })
})
