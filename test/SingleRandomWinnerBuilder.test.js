const { deployments } = require("@nomiclabs/buidler");
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')
const { ethers } = require('ethers')
const { AddressZero } = ethers.constants
const { deployMockContract } = require('./helpers/deployMockContract')
const InitializableAdminUpgradeabilityProxy = require('@openzeppelin/upgrades/build/contracts/InitializableAdminUpgradeabilityProxy.json')
const PrizePool = require('../build/PrizePool.json')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:SingleRandomWinnerBuilder.test')

describe('SingleRandomWinnerBuilder', () => {

  let wallet

  let builder

  let comptroller,
      trustedForwarder,
      controlledTokenProxyFactory,
      ticketProxyFactory,
      rngServiceMock,
      prizePool

  let singleRandomWinnerConfig

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()
    await deployments.fixture()
    builder = await buidler.ethers.getContractAt(
      "SingleRandomWinnerBuilder",
      (await deployments.get("SingleRandomWinnerBuilder")).address,
      wallet
    )

    comptroller = (await deployments.get("Comptroller"))
    trustedForwarder = (await deployments.get("TrustedForwarder"))
    singleRandomWinnerProxyFactory = (await deployments.get("SingleRandomWinnerProxyFactory"))
    controlledTokenProxyFactory = (await deployments.get("ControlledTokenProxyFactory"))
    ticketProxyFactory = (await deployments.get("TicketProxyFactory"))
    rngServiceMock = (await deployments.get("RNGServiceMock"))

    prizePool = await deployMockContract(wallet, PrizePool.abi)

    singleRandomWinnerConfig = {
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
  })

  describe('initialize()', () => {
    it('should setup all factories', async () => {
      expect(await builder.comptroller()).to.equal(comptroller.address)
      expect(await builder.singleRandomWinnerProxyFactory()).to.equal(singleRandomWinnerProxyFactory.address)
      expect(await builder.trustedForwarder()).to.equal(trustedForwarder.address)
      expect(await builder.controlledTokenProxyFactory()).to.equal(controlledTokenProxyFactory.address)
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

  describe('createSingleRandomWinner()', () => {
    it('should allow a user to a Single Random Winner strategy', async () => {

      let tx = await builder.createSingleRandomWinner(
        prizePool.address,
        singleRandomWinnerConfig,
        8,
        wallet._address
      )
      let events = await getEvents(tx)
      let singleRandomWinnerCreatedEvent = events.find(e => e.name == 'SingleRandomWinnerCreated')

      const prizeStrategy = await buidler.ethers.getContractAt('SingleRandomWinnerHarness', singleRandomWinnerCreatedEvent.args.singleRandomWinner, wallet)
      const ticketAddress = singleRandomWinnerCreatedEvent.args.ticket
      const sponsorshipAddress = singleRandomWinnerCreatedEvent.args.sponsorship

      expect(await prizeStrategy.ticket()).to.equal(ticketAddress)
      expect(await prizeStrategy.sponsorship()).to.equal(sponsorshipAddress)

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
    })
  })
})
