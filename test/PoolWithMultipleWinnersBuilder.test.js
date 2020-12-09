const { deployments } = require("@nomiclabs/buidler");
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')
const { ethers } = require('ethers')
const { AddressZero } = ethers.constants
const { getEvents } = require('./helpers/getEvents')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:PoolWithMultipleWinnersBuilder.test.js')

describe('PoolWithMultipleWinnersBuilder', () => {

  let wallet

  let builder

  let compoundPrizePoolBuilder,
      vaultPrizePoolBuilder,
      stakePrizePoolBuilder,
      multipleWinnersBuilder

  let multipleWinnersConfig

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()

    await deployments.fixture()
    
    builder = await buidler.ethers.getContractAt(
      "PoolWithMultipleWinnersBuilder",
      (await deployments.get("PoolWithMultipleWinnersBuilder")).address,
      wallet
    )

    dai = (await deployments.get("Dai"))
    vault = (await deployments.get("yDai"))
    cToken = (await deployments.get("cDai"))
    rngServiceMock = (await deployments.get("RNGServiceMock"))
    compoundPrizePoolBuilder = (await deployments.get("CompoundPrizePoolBuilder"))
    vaultPrizePoolBuilder = (await deployments.get("VaultPrizePoolBuilder"))
    stakePrizePoolBuilder = (await deployments.get("StakePrizePoolBuilder"))
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
      expect(await builder.compoundPrizePoolBuilder()).to.equal(compoundPrizePoolBuilder.address)
      expect(await builder.stakePrizePoolBuilder()).to.equal(stakePrizePoolBuilder.address)
      expect(await builder.vaultPrizePoolBuilder()).to.equal(vaultPrizePoolBuilder.address)
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

      const prizePool = await buidler.ethers.getContractAt('CompoundPrizePoolHarness', prizePoolCreatedEvent.args.prizePool, wallet)
      const prizeStrategy = await buidler.ethers.getContractAt('MultipleWinners', prizePoolCreatedEvent.args.prizeStrategy, wallet)

      expect(await prizePool.prizeStrategy()).to.equal(prizeStrategy.address)
      expect(await prizePool.owner()).to.equal(wallet._address)
      expect(await prizeStrategy.owner()).to.equal(wallet._address)

      const ticketAddress = await prizeStrategy.ticket()
      expect(await prizePool.creditPlanOf(ticketAddress)).to.deep.equal([
        multipleWinnersConfig.ticketCreditLimitMantissa,
        multipleWinnersConfig.ticketCreditRateMantissa
      ])
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

      const prizePool = await buidler.ethers.getContractAt('StakePrizePool', prizePoolCreatedEvent.args.prizePool, wallet)
      const prizeStrategy = await buidler.ethers.getContractAt('MultipleWinners', prizePoolCreatedEvent.args.prizeStrategy, wallet)

      expect(await prizePool.token()).to.equal(cToken.address)
      expect(await prizePool.prizeStrategy()).to.equal(prizeStrategy.address)
      expect(await prizePool.owner()).to.equal(wallet._address)
      expect(await prizeStrategy.owner()).to.equal(wallet._address)
    })
  })

  describe('createVaultMultipleWinners()', () => {
    let vaultPrizePoolConfig

    beforeEach(async () => {
      vaultPrizePoolConfig = {
        vault: vault.address,
        reserveRateMantissa: toWei('0.05'),
        maxExitFeeMantissa: toWei('0.5'),
        maxTimelockDuration: 1000
      }
    })

    it('should create a new prize pool and strategy', async () => {
      debug('Creating pool & strategy...')
      let decimals = 9

      let tx = await builder.createVaultMultipleWinners(
        vaultPrizePoolConfig,
        multipleWinnersConfig,
        decimals
      )

      debug('Getting events...')

      let events = await getEvents(builder, tx)
      let prizePoolCreatedEvent = events.find(e => e.name == 'VaultPrizePoolWithMultipleWinnersCreated')

      debug(`Creating prize pool using address: ${prizePoolCreatedEvent.args.prizePool}...`)

      const prizePool = await buidler.ethers.getContractAt('yVaultPrizePool', prizePoolCreatedEvent.args.prizePool, wallet)
      const prizeStrategy = await buidler.ethers.getContractAt('MultipleWinners', prizePoolCreatedEvent.args.prizeStrategy, wallet)

      expect(await prizePool.token()).to.equal(dai.address)
      expect(await prizePool.prizeStrategy()).to.equal(prizeStrategy.address)
      expect(await prizePool.owner()).to.equal(wallet._address)
      expect(await prizeStrategy.owner()).to.equal(wallet._address)
    })
  })
})
