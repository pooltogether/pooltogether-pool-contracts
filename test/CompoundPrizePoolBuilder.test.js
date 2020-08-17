const { deployments } = require("@nomiclabs/buidler");
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')
const { ethers } = require('ethers')
const { AddressZero } = ethers.constants

const toWei = ethers.utils.parseEther

describe('CompoundPrizePoolBuilder', () => {

  let wallet, env

  let builder

  let comptroller,
      trustedForwarder,
      prizeStrategyProxyFactory,
      compoundPrizePoolProxyFactory,
      controlledTokenProxyFactory,
      rngServiceMock,
      proxyFactory,
      cToken

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()
    await deployments.fixture()
    builder = await buidler.ethers.getContractAt(
      "CompoundPrizePoolBuilder",
      (await deployments.get("CompoundPrizePoolBuilder")).address,
      wallet
    )

    comptroller = (await deployments.get("Comptroller")).address
    trustedForwarder = (await deployments.get("TrustedForwarder")).address
    prizeStrategyProxyFactory = (await deployments.get("PrizeStrategyProxyFactory")).address
    compoundPrizePoolProxyFactory = (await deployments.get("CompoundPrizePoolProxyFactory")).address
    controlledTokenProxyFactory = (await deployments.get("ControlledTokenProxyFactory")).address
    rngServiceMock = (await deployments.get("RNGServiceMock")).address
    proxyFactory = (await deployments.get("ProxyFactory")).address
    cToken = (await deployments.get("cDai")).address
  })

  describe('initialize()', () => {
    it('should setup all factories', async () => {
      expect(await builder.comptroller()).to.equal(comptroller)
      expect(await builder.prizeStrategyProxyFactory()).to.equal(prizeStrategyProxyFactory)
      expect(await builder.trustedForwarder()).to.equal(trustedForwarder)
      expect(await builder.compoundPrizePoolProxyFactory()).to.equal(compoundPrizePoolProxyFactory)
      expect(await builder.controlledTokenProxyFactory()).to.equal(controlledTokenProxyFactory)
      expect(await builder.proxyFactory()).to.equal(proxyFactory)
    })
  })

  describe('create()', () => {
    it('should allow a user to create upgradeable pools', async () => {
      const proxyAdmin = (await deployments.get("ProxyAdmin")).address
      const config = {
        proxyAdmin,
        cToken: cToken,
        rngService: rngServiceMock,
        prizePeriodStart: 0,
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

      let prizeStrategy = await buidler.ethers.getContractAt('PrizeStrategyHarness', event.args.prizeStrategy, wallet)
      let prizePool = await buidler.ethers.getContractAt('CompoundPrizePoolHarness', event.args.prizePool, wallet)

      expect(await prizePool.cToken()).to.equal(config.cToken)
      expect(await prizeStrategy.prizePeriodSeconds()).to.equal(config.prizePeriodSeconds)
    })

    it('should create a new prize strategy and pool', async () => {
      const config = {
        proxyAdmin: AddressZero,
        cToken: cToken,
        rngService: rngServiceMock,
        prizePeriodStart: 0,
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

      let prizeStrategy = await buidler.ethers.getContractAt('PrizeStrategyHarness', event.args.prizeStrategy, wallet)
      let prizePool = await buidler.ethers.getContractAt('CompoundPrizePoolHarness', event.args.prizePool, wallet)

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
      expect(await prizePool.creditRateOf(ticket.address)).to.deep.equal([config.exitFeeMantissa, config.creditRateMantissa])

      expect(await prizePool.owner()).to.equal(wallet._address)
      expect(await prizeStrategy.owner()).to.equal(wallet._address)
    })
  })
})
