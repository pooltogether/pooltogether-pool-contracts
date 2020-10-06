const { deployments } = require("@nomiclabs/buidler");
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')
const { ethers } = require('ethers')
const { AddressZero } = ethers.constants
const { deployMockContract } = require('./helpers/deployMockContract')
const InitializableAdminUpgradeabilityProxy = require('@openzeppelin/upgrades/build/contracts/InitializableAdminUpgradeabilityProxy.json')
const TokenListenerInterface = require('../build/TokenListenerInterface.json')

const toWei = ethers.utils.parseEther

describe('StakePrizePoolBuilder', () => {

  let wallet

  let builder

  let reserve,
      trustedForwarder,
      singleRandomWinnerBuilder,
      stakePrizePoolProxyFactory,
      rngServiceMock,
      token

  let singleRandomWinnerConfig,
      stakePrizePoolConfig

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()
    await deployments.fixture()
    builder = await buidler.ethers.getContractAt(
      "StakePrizePoolBuilder",
      (await deployments.get("StakePrizePoolBuilder")).address,
      wallet
    )

    reserve = (await deployments.get("Reserve"))
    trustedForwarder = (await deployments.get("TrustedForwarder"))
    singleRandomWinnerBuilder = (await deployments.get("SingleRandomWinnerBuilder"))
    stakePrizePoolProxyFactory = (await deployments.get("StakePrizePoolProxyFactory"))
    rngServiceMock = (await deployments.get("RNGServiceMock"))
    token = (await deployments.get("Dai"))

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

    stakePrizePoolConfig = {
      token: token.address,
      reserveRateMantissa: toWei('0.05'),
      maxExitFeeMantissa: toWei('0.5'),
      maxTimelockDuration: 1000
    }

  })

  describe('initialize()', () => {
    it('should setup all factories', async () => {
      expect(await builder.reserve()).to.equal(reserve.address)
      expect(await builder.singleRandomWinnerBuilder()).to.equal(singleRandomWinnerBuilder.address)
      expect(await builder.trustedForwarder()).to.equal(trustedForwarder.address)
      expect(await builder.stakePrizePoolProxyFactory()).to.equal(stakePrizePoolProxyFactory.address)
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

  describe('createStakePrizePool()', () => {
    it('should allow a user to create a StakePrizePool', async () => {
      let tx = await builder.createStakePrizePool(stakePrizePoolConfig)
      let events = await getEvents(tx)
      let event = events[0]

      expect(event.name).to.equal('PrizePoolCreated')

      const prizePool = await buidler.ethers.getContractAt('StakePrizePool', event.args.prizePool, wallet)

      expect(await prizePool.token()).to.equal(stakePrizePoolConfig.token)
      expect(await prizePool.maxExitFeeMantissa()).to.equal(stakePrizePoolConfig.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(stakePrizePoolConfig.maxTimelockDuration)
      expect(await prizePool.owner()).to.equal(wallet._address)
      expect(await prizePool.prizeStrategy()).to.equal(AddressZero)
    })
  })

  describe('createSingleRandomWinner()', () => {
    it('should allow a user to create Stake Prize Pools with Single Random Winner strategy', async () => {
      let decimals = 18

      let tx = await builder.createSingleRandomWinner(stakePrizePoolConfig, singleRandomWinnerConfig, decimals)
      let events = await getEvents(tx)
      let prizePoolCreatedEvent = events.find(e => e.name == 'PrizePoolCreated')

      const prizePool = await buidler.ethers.getContractAt('StakePrizePool', prizePoolCreatedEvent.args.prizePool, wallet)
      const prizeStrategy = await buidler.ethers.getContractAt('SingleRandomWinnerHarness', await prizePool.prizeStrategy(), wallet)
      const ticketAddress = await prizeStrategy.ticket()
      const sponsorshipAddress = await prizeStrategy.sponsorship()

      expect(await prizeStrategy.ticket()).to.equal(ticketAddress)
      expect(await prizeStrategy.sponsorship()).to.equal(sponsorshipAddress)

      expect(await prizePool.token()).to.equal(stakePrizePoolConfig.token)
      expect(await prizePool.maxExitFeeMantissa()).to.equal(stakePrizePoolConfig.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(stakePrizePoolConfig.maxTimelockDuration)
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
      expect(await prizePool.maxExitFeeMantissa()).to.equal(stakePrizePoolConfig.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(stakePrizePoolConfig.maxTimelockDuration)

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
