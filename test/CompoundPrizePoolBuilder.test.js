const { deployments } = require("@nomiclabs/buidler");
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')
const { ethers } = require('ethers')
const { AddressZero } = ethers.constants
const { deployMockContract } = require('./helpers/deployMockContract')
const InitializableAdminUpgradeabilityProxy = require('@openzeppelin/upgrades/build/contracts/InitializableAdminUpgradeabilityProxy.json')
const PrizePoolTokenListenerInterface = require('../build/PrizePoolTokenListenerInterface.json')

const toWei = ethers.utils.parseEther

describe('CompoundPrizePoolBuilder', () => {

  let wallet, env

  let builder

  let comptroller,
      trustedForwarder,
      prizeStrategyProxyFactory,
      proxyFactory,
      compoundPrizePoolProxyFactory,
      controlledTokenProxyFactory,
      rngServiceMock,
      cToken

  let singleRandomWinnerConfig,
      compoundPrizePoolConfig

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()
    await deployments.fixture()
    builder = await buidler.ethers.getContractAt(
      "CompoundPrizePoolBuilder",
      (await deployments.get("CompoundPrizePoolBuilder")).address,
      wallet
    )

    comptroller = (await deployments.get("Comptroller"))
    trustedForwarder = (await deployments.get("TrustedForwarder"))
    prizeStrategyProxyFactory = (await deployments.get("SingleRandomWinnerProxyFactory"))
    compoundPrizePoolProxyFactory = (await deployments.get("CompoundPrizePoolProxyFactory"))
    controlledTokenProxyFactory = (await deployments.get("ControlledTokenProxyFactory"))
    ticketProxyFactory = (await deployments.get("TicketProxyFactory"))
    proxyFactory = (await deployments.get("ProxyFactory"))
    rngServiceMock = (await deployments.get("RNGServiceMock"))
    cToken = (await deployments.get("cDai"))

    singleRandomWinnerConfig = {
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
      externalERC20Awards: []
    }

    compoundPrizePoolConfig = {
      cToken: cToken.address,
      maxExitFeeMantissa: toWei('0.5'),
      maxTimelockDuration: 1000
    }

  })

  describe('initialize()', () => {
    it('should setup all factories', async () => {
      expect(await builder.comptroller()).to.equal(comptroller.address)
      expect(await builder.singleRandomWinnerProxyFactory()).to.equal(prizeStrategyProxyFactory.address)
      expect(await builder.trustedForwarder()).to.equal(trustedForwarder.address)
      expect(await builder.compoundPrizePoolProxyFactory()).to.equal(compoundPrizePoolProxyFactory.address)
      expect(await builder.controlledTokenProxyFactory()).to.equal(controlledTokenProxyFactory.address)
      expect(await builder.proxyFactory()).to.equal(proxyFactory.address)
      expect(await builder.ticketProxyFactory()).to.equal(ticketProxyFactory.address)
    })
  })

  async function getEvents(tx) {
    let receipt = await buidler.ethers.provider.getTransactionReceipt(tx.hash)
    return receipt.logs.reduce((parsedEvents, log) => {
      try {
        parsedEvents.push(builder.interface.parseLog(log))
      } catch (e) {}
      return parsedEvents
    }, [])
  }

  describe('createCompoundPrizePool()', () => {
    it('should allow a user to create a CompoundPrizePool', async () => {
      const prizeStrategy = await deployMockContract(wallet, PrizePoolTokenListenerInterface.abi)

      let tx = await builder.createCompoundPrizePool(compoundPrizePoolConfig, prizeStrategy.address)
      let events = await getEvents(tx)
      let event = events[0]

      expect(event.name).to.equal('CompoundPrizePoolCreated')

      const prizePool = await buidler.ethers.getContractAt('CompoundPrizePoolHarness', event.args.prizePool, wallet)

      expect(await prizePool.cToken()).to.equal(compoundPrizePoolConfig.cToken)
      expect(await prizePool.maxExitFeeMantissa()).to.equal(compoundPrizePoolConfig.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(compoundPrizePoolConfig.maxTimelockDuration)
      expect(await prizePool.owner()).to.equal(wallet._address)
      expect(await prizePool.prizeStrategy()).to.equal(prizeStrategy.address)
    })
  })

  describe('createSingleRandomWinner()', () => {
    it('should allow a user to create Compound Prize Pools with Single Random Winner strategy', async () => {

      let tx = await builder.createSingleRandomWinner(compoundPrizePoolConfig, singleRandomWinnerConfig)
      let events = await getEvents(tx)
      let prizePoolCreatedEvent = events.find(e => e.name == 'CompoundPrizePoolCreated')
      let singleRandomWinnerCreatedEvent = events.find(e => e.name == 'SingleRandomWinnerCreated')

      const prizeStrategy = await buidler.ethers.getContractAt('SingleRandomWinnerHarness', prizePoolCreatedEvent.args.prizeStrategy, wallet)
      const prizePool = await buidler.ethers.getContractAt('CompoundPrizePoolHarness', prizePoolCreatedEvent.args.prizePool, wallet)
      expect(singleRandomWinnerCreatedEvent.args.singleRandomWinner).to.equal(prizePoolCreatedEvent.args.prizeStrategy)
      const ticketAddress = singleRandomWinnerCreatedEvent.args.ticket
      const sponsorshipAddress = singleRandomWinnerCreatedEvent.args.sponsorship

      expect(await prizeStrategy.ticket()).to.equal(ticketAddress)
      expect(await prizeStrategy.sponsorship()).to.equal(sponsorshipAddress)

      expect(await prizePool.cToken()).to.equal(compoundPrizePoolConfig.cToken)
      expect(await prizePool.maxExitFeeMantissa()).to.equal(compoundPrizePoolConfig.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(compoundPrizePoolConfig.maxTimelockDuration)
      expect(await prizePool.owner()).to.equal(wallet._address)

      expect(await prizeStrategy.prizePeriodStartedAt()).to.equal(singleRandomWinnerConfig.prizePeriodStart)
      expect(await prizeStrategy.prizePeriodSeconds()).to.equal(singleRandomWinnerConfig.prizePeriodSeconds)
      expect(await prizeStrategy.owner()).to.equal(wallet._address)
      expect(await prizeStrategy.rng()).to.equal(singleRandomWinnerConfig.rngService)

      const ticket = await buidler.ethers.getContractAt('Ticket', ticketAddress, wallet)
      expect(await ticket.name()).to.equal(singleRandomWinnerConfig.ticketName)
      expect(await ticket.symbol()).to.equal(singleRandomWinnerConfig.ticketSymbol)

      const sponsorship = await buidler.ethers.getContractAt('ControlledToken', sponsorshipAddress, wallet)
      expect(await sponsorship.name()).to.equal(singleRandomWinnerConfig.sponsorshipName)
      expect(await sponsorship.symbol()).to.equal(singleRandomWinnerConfig.sponsorshipSymbol)

      expect(await prizePool.reserveFeeControlledToken()).to.equal(sponsorshipAddress)
      expect(await prizePool.maxExitFeeMantissa()).to.equal(compoundPrizePoolConfig.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(compoundPrizePoolConfig.maxTimelockDuration)

      expect(await prizePool.creditPlanOf(ticket.address)).to.deep.equal([
        singleRandomWinnerConfig.ticketCreditLimitMantissa,
        singleRandomWinnerConfig.ticketCreditRateMantissa
      ])

      expect(await prizePool.creditPlanOf(sponsorship.address)).to.deep.equal([
        ethers.BigNumber.from('0'),
        ethers.BigNumber.from('0')
      ])
    })

    it('should allow a user to create an upgradeable Single Random Winner strategy', async () => {
      const proxyAdmin = await deployMockContract(wallet, (await deployments.get("ProxyAdmin")).abi)

      singleRandomWinnerConfig.proxyAdmin = proxyAdmin.address

      let tx = await builder.createSingleRandomWinner(compoundPrizePoolConfig, singleRandomWinnerConfig)
      let events = await getEvents(tx)
      let event = events.find(e => e.name == 'CompoundPrizePoolCreated')

      const prizeStrategyProxy = new ethers.Contract(event.args.prizeStrategy, InitializableAdminUpgradeabilityProxy.abi, wallet)

      expect(await proxyAdmin.staticcall(prizeStrategyProxy, 'admin')).to.equal(proxyAdmin.address)
    })
  })
})
