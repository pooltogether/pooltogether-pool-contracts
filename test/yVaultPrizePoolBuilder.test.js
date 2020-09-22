const { deployments } = require("@nomiclabs/buidler");
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')
const { ethers } = require('ethers')
const { AddressZero } = ethers.constants
const { deployMockContract } = require('./helpers/deployMockContract')
const InitializableAdminUpgradeabilityProxy = require('@openzeppelin/upgrades/build/contracts/InitializableAdminUpgradeabilityProxy.json')
const PrizePoolTokenListenerInterface = require('../build/PrizePoolTokenListenerInterface.json')

const toWei = ethers.utils.parseEther

describe('yVaultPrizePoolBuilder', () => {

  let wallet, env

  let builder

  let comptroller,
      trustedForwarder,
      prizeStrategyProxyFactory,
      proxyFactory,
      vaultPrizePoolProxyFactory,
      controlledTokenProxyFactory,
      rngServiceMock,
      vault

  let singleRandomWinnerConfig,
      vaultPrizePoolConfig

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()
    await deployments.fixture()
    builder = await buidler.ethers.getContractAt(
      "yVaultPrizePoolBuilder",
      (await deployments.get("yVaultPrizePoolBuilder")).address,
      wallet
    )

    comptroller = (await deployments.get("Comptroller"))
    trustedForwarder = (await deployments.get("TrustedForwarder"))
    prizeStrategyProxyFactory = (await deployments.get("SingleRandomWinnerProxyFactory"))
    vaultPrizePoolProxyFactory = (await deployments.get("yVaultPrizePoolProxyFactory"))
    controlledTokenProxyFactory = (await deployments.get("ControlledTokenProxyFactory"))
    ticketProxyFactory = (await deployments.get("TicketProxyFactory"))
    proxyFactory = (await deployments.get("ProxyFactory"))
    rngServiceMock = (await deployments.get("RNGServiceMock"))
    vault = (await deployments.get("yDai"))

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

    vaultPrizePoolConfig = {
      vault: vault.address,
      reserveRateMantissa: toWei('0.05'),
      maxExitFeeMantissa: toWei('0.5'),
      maxTimelockDuration: 1000
    }

  })

  describe('initialize()', () => {
    it('should setup all factories', async () => {
      expect(await builder.comptroller()).to.equal(comptroller.address)
      expect(await builder.singleRandomWinnerProxyFactory()).to.equal(prizeStrategyProxyFactory.address)
      expect(await builder.trustedForwarder()).to.equal(trustedForwarder.address)
      expect(await builder.vaultPrizePoolProxyFactory()).to.equal(vaultPrizePoolProxyFactory.address)
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

  describe('createyVaultPrizePool()', () => {
    it('should allow a user to create a yVaultPrizePool', async () => {
      const prizeStrategy = await deployMockContract(wallet, PrizePoolTokenListenerInterface.abi)

      let tx = await builder.createyVaultPrizePool(vaultPrizePoolConfig, prizeStrategy.address)
      let events = await getEvents(tx)
      let event = events[0]

      expect(event.name).to.equal('yVaultPrizePoolCreated')

      const prizePool = await buidler.ethers.getContractAt('yVaultPrizePoolHarness', event.args.prizePool, wallet)

      expect(await prizePool.vault()).to.equal(vaultPrizePoolConfig.vault)
      expect(await prizePool.maxExitFeeMantissa()).to.equal(vaultPrizePoolConfig.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(vaultPrizePoolConfig.maxTimelockDuration)
      expect(await prizePool.owner()).to.equal(wallet._address)
      expect(await prizePool.prizeStrategy()).to.equal(prizeStrategy.address)
    })
  })

  describe('createSingleRandomWinner()', () => {
    it('should allow a user to create yVault Prize Pools with Single Random Winner strategy', async () => {

      let decimals = 18

      let tx = await builder.createSingleRandomWinner(vaultPrizePoolConfig, singleRandomWinnerConfig, decimals)
      let events = await getEvents(tx)
      let prizePoolCreatedEvent = events.find(e => e.name == 'yVaultPrizePoolCreated')
      let singleRandomWinnerCreatedEvent = events.find(e => e.name == 'SingleRandomWinnerCreated')

      const prizeStrategy = await buidler.ethers.getContractAt('SingleRandomWinnerHarness', prizePoolCreatedEvent.args.prizeStrategy, wallet)
      const prizePool = await buidler.ethers.getContractAt('yVaultPrizePoolHarness', prizePoolCreatedEvent.args.prizePool, wallet)
      expect(singleRandomWinnerCreatedEvent.args.singleRandomWinner).to.equal(prizePoolCreatedEvent.args.prizeStrategy)
      const ticketAddress = singleRandomWinnerCreatedEvent.args.ticket
      const sponsorshipAddress = singleRandomWinnerCreatedEvent.args.sponsorship

      expect(await prizeStrategy.ticket()).to.equal(ticketAddress)
      expect(await prizeStrategy.sponsorship()).to.equal(sponsorshipAddress)

      expect(await prizePool.vault()).to.equal(vaultPrizePoolConfig.vault)
      expect(await prizePool.maxExitFeeMantissa()).to.equal(vaultPrizePoolConfig.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(vaultPrizePoolConfig.maxTimelockDuration)
      expect(await prizePool.owner()).to.equal(wallet._address)

      expect(await prizeStrategy.prizePeriodStartedAt()).to.equal(singleRandomWinnerConfig.prizePeriodStart)
      expect(await prizeStrategy.prizePeriodSeconds()).to.equal(singleRandomWinnerConfig.prizePeriodSeconds)
      expect(await prizeStrategy.owner()).to.equal(wallet._address)
      expect(await prizeStrategy.rng()).to.equal(singleRandomWinnerConfig.rngService)

      const ticket = await buidler.ethers.getContractAt('Ticket', ticketAddress, wallet)
      expect(await ticket.name()).to.equal(singleRandomWinnerConfig.ticketName)
      expect(await ticket.symbol()).to.equal(singleRandomWinnerConfig.ticketSymbol)
      expect(await ticket.decimals()).to.equal(decimals)

      const sponsorship = await buidler.ethers.getContractAt('ControlledToken', sponsorshipAddress, wallet)
      expect(await sponsorship.name()).to.equal(singleRandomWinnerConfig.sponsorshipName)
      expect(await sponsorship.symbol()).to.equal(singleRandomWinnerConfig.sponsorshipSymbol)
      expect(await sponsorship.decimals()).to.equal(decimals)

      expect(await prizePool.reserveFeeControlledToken()).to.equal(sponsorshipAddress)
      expect(await prizePool.maxExitFeeMantissa()).to.equal(vaultPrizePoolConfig.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(vaultPrizePoolConfig.maxTimelockDuration)

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

      let tx = await builder.createSingleRandomWinner(vaultPrizePoolConfig, singleRandomWinnerConfig, 8)
      let events = await getEvents(tx)
      let event = events.find(e => e.name == 'yVaultPrizePoolCreated')

      const prizeStrategyProxy = new ethers.Contract(event.args.prizeStrategy, InitializableAdminUpgradeabilityProxy.abi, wallet)

      expect(await proxyAdmin.staticcall(prizeStrategyProxy, 'admin')).to.equal(proxyAdmin.address)
    })
  })
})
