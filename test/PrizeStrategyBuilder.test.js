const { deployContracts } = require('../js/deployContracts')
const { expect } = require('chai')
const buidler = require('./helpers/buidler')
const { ethers } = require('ethers')

const toWei = ethers.utils.parseEther

describe('CompoundPrizePoolBuilder', () => {

  let wallet, env

  let builder

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()
    env = await deployContracts(wallet)
    builder = env.compoundPrizePoolBuilder
  })

  describe('initialize()', () => {
    it('should setup all factories', async () => {
      expect(await builder.governor()).to.equal(env.governor.address)
      expect(await builder.prizeStrategyProxyFactory()).to.equal(env.prizeStrategyProxyFactory.address)
      expect(await builder.trustedForwarder()).to.equal(env.forwarder.address)
      expect(await builder.compoundPrizePoolProxyFactory()).to.equal(env.compoundPrizePoolProxyFactory.address)
      expect(await builder.controlledTokenProxyFactory()).to.equal(env.controlledTokenProxyFactory.address)
      expect(await builder.rng()).to.equal(env.rng.address)
    })
  })

  describe('create()', () => {
    it('should create a new prize strategy and pool', async () => {
      const config = {
        cToken: env.cToken.address,
        prizePeriodSeconds: 10,
        ticketName: "Ticket",
        ticketSymbol: "TICK",
        sponsorshipName: "Sponsorship",
        sponsorshipSymbol: "SPON",
        maxExitFeeMantissa: toWei('0.5'),
        maxTimelockDuration: 1000,
        exitFeeMantissa: toWei('0.1'),
        creditRateMantissa: toWei('0.001'),
        externalERC20Awards: []
      }
      let tx = await builder.create(config)
      let receipt = await buidler.ethers.provider.getTransactionReceipt(tx.hash)
      let event = builder.interface.parseLog(receipt.logs[receipt.logs.length - 1])

      expect(event.name).to.equal('CompoundPrizePoolCreated')

      let prizeStrategy = await buidler.ethers.getContractAt('PrizeStrategyHarness', event.values.prizeStrategy, wallet)
      let prizePool = await buidler.ethers.getContractAt('CompoundPrizePoolHarness', event.values.prizePool, wallet)

      expect(await prizePool.cToken()).to.equal(config.cToken)
      expect(await prizeStrategy.prizePeriodSeconds()).to.equal(config.prizePeriodSeconds)

      let ticket = await buidler.ethers.getContractAt('ControlledToken', await prizeStrategy.ticket(), wallet)
      expect(await ticket.name()).to.equal(config.ticketName)
      expect(await ticket.symbol()).to.equal(config.ticketSymbol)

      let sponsorship = await buidler.ethers.getContractAt('ControlledToken', await prizeStrategy.sponsorship(), wallet)
      expect(await sponsorship.name()).to.equal(config.sponsorshipName)
      expect(await sponsorship.symbol()).to.equal(config.sponsorshipSymbol)

      expect(await prizePool.maxExitFeeMantissa()).to.equal(config.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(config.maxTimelockDuration)
      expect(await prizeStrategy.exitFeeMantissa()).to.equal(config.exitFeeMantissa)
      expect(await prizeStrategy.creditRateMantissa()).to.equal(config.creditRateMantissa)

      expect(await prizePool.owner()).to.equal(wallet._address)
      expect(await prizeStrategy.owner()).to.equal(wallet._address)
    })
  })
})
