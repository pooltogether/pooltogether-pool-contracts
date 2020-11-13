const { deployments } = require("@nomiclabs/buidler");
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')
const { ethers } = require('ethers')
const { AddressZero } = ethers.constants

const toWei = ethers.utils.parseEther

describe('AavePrizePoolBuilder', () => {
  let wallet

  let builder

  let reserveRegistry,
    trustedForwarder,
    singleRandomWinnerBuilder,
    aavePrizePoolProxyFactory,
    rngServiceMock,
    aToken,
    lendingPoolAddressesProviderAddress

  let singleRandomWinnerConfig,
      aavePrizePoolConfig

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()
    await deployments.fixture()
    builder = await buidler.ethers.getContractAt(
      "AavePrizePoolBuilder",
      (await deployments.get("AavePrizePoolBuilder")).address,
      wallet
    )

    reserveRegistry = (await deployments.get("ReserveRegistry"))
    trustedForwarder = (await deployments.get("TrustedForwarder"))
    singleRandomWinnerBuilder = (await deployments.get("SingleRandomWinnerBuilder"))
    aavePrizePoolProxyFactory = (await deployments.get("AavePrizePoolProxyFactory"))
    rngServiceMock = (await deployments.get("RNGServiceMock"))
    aToken = (await deployments.get("aDai"))
    lendingPoolAddressesProviderAddress = '0x24a42fD28C976A61Df5D00D0599C34c4f90748c8'

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

    aavePrizePoolConfig = {
      aToken: aToken.address,
      maxExitFeeMantissa: toWei('0.5'),
      maxTimelockDuration: 1000
    }

  })

  describe('initialize()', () => {
    it('should setup all factories', async () => {
      expect(await builder.reserveRegistry()).to.equal(reserveRegistry.address)
      expect(await builder.singleRandomWinnerBuilder()).to.equal(singleRandomWinnerBuilder.address)
      expect(await builder.trustedForwarder()).to.equal(trustedForwarder.address)
      expect(await builder.aavePrizePoolProxyFactory()).to.equal(aavePrizePoolProxyFactory.address)
      expect(await builder.lendingPoolAddressesProviderAddress()).to.equal(
        lendingPoolAddressesProviderAddress
      )
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

  describe('createAavePrizePool()', () => {
    it('should allow a user to create a AavePrizePool', async () => {
      let tx = await builder.createAavePrizePool(aavePrizePoolConfig)
      let events = await getEvents(tx)
      let event = events[0]

      expect(event.name).to.equal('PrizePoolCreated')

      const prizePool = await buidler.ethers.getContractAt('AavePrizePoolHarness', event.args.prizePool, wallet)

      expect(await prizePool.aToken()).to.equal(aavePrizePoolConfig.aToken)
      expect(await prizePool.lendingPoolAddressesProviderAddress()).to.equal(lendingPoolAddressesProviderAddress)
      expect(await prizePool.maxExitFeeMantissa()).to.equal(aavePrizePoolConfig.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(aavePrizePoolConfig.maxTimelockDuration)
      expect(await prizePool.owner()).to.equal(wallet._address)
      expect(await prizePool.prizeStrategy()).to.equal(AddressZero)
    })
  })

  describe('createSingleRandomWinner()', () => {
    it('should allow a user to create Aave Prize Pools with Single Random Winner strategy', async () => {
      let tx = await builder.createSingleRandomWinner(aavePrizePoolConfig, singleRandomWinnerConfig, 9)
      let events = await getEvents(tx)
      let prizePoolCreatedEvent = events.find(e => e.name == 'PrizePoolCreated')

      const prizePool = await buidler.ethers.getContractAt('AavePrizePoolHarness', prizePoolCreatedEvent.args.prizePool, wallet)
      const prizeStrategy = await buidler.ethers.getContractAt('SingleRandomWinnerHarness', await prizePool.prizeStrategy(), wallet)

      const ticketAddress = await prizeStrategy.ticket()
      const sponsorshipAddress = await prizeStrategy.sponsorship()

      expect(await prizeStrategy.ticket()).to.equal(ticketAddress)
      expect(await prizeStrategy.sponsorship()).to.equal(sponsorshipAddress)

      expect(await prizePool.aToken()).to.equal(aavePrizePoolConfig.aToken)
      expect(await prizePool.lendingPoolAddressesProviderAddress()).to.equal(lendingPoolAddressesProviderAddress)
      expect(await prizePool.maxExitFeeMantissa()).to.equal(aavePrizePoolConfig.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(aavePrizePoolConfig.maxTimelockDuration)
      expect(await prizePool.owner()).to.equal(wallet._address)

      expect(await prizeStrategy.prizePeriodStartedAt()).to.equal(singleRandomWinnerConfig.prizePeriodStart)
      expect(await prizeStrategy.prizePeriodSeconds()).to.equal(singleRandomWinnerConfig.prizePeriodSeconds)
      expect(await prizeStrategy.owner()).to.equal(wallet._address)
      expect(await prizeStrategy.rng()).to.equal(singleRandomWinnerConfig.rngService)

      const ticket = await buidler.ethers.getContractAt('Ticket', ticketAddress, wallet)
      expect(await ticket.name()).to.equal(singleRandomWinnerConfig.ticketName)
      expect(await ticket.symbol()).to.equal(singleRandomWinnerConfig.ticketSymbol)
      expect(await ticket.decimals()).to.equal(9)

      const sponsorship = await buidler.ethers.getContractAt('ControlledToken', sponsorshipAddress, wallet)
      expect(await sponsorship.name()).to.equal(singleRandomWinnerConfig.sponsorshipName)
      expect(await sponsorship.symbol()).to.equal(singleRandomWinnerConfig.sponsorshipSymbol)
      expect(await sponsorship.decimals()).to.equal(9)

      expect(await prizePool.maxExitFeeMantissa()).to.equal(aavePrizePoolConfig.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(aavePrizePoolConfig.maxTimelockDuration)

      expect(await prizePool.creditPlanOf(ticket.address)).to.deep.equal([
        singleRandomWinnerConfig.ticketCreditLimitMantissa,
        singleRandomWinnerConfig.ticketCreditRateMantissa
      ])

      expect(await prizePool.creditPlanOf(sponsorship.address)).to.deep.equal([
        ethers.BigNumber.from('0'),
        ethers.BigNumber.from('0')
      ])
    })
  })
})
