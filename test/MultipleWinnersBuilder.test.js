const { deployments } = require("@nomiclabs/buidler");
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')
const { ethers } = require('ethers')
const { deployMockContract } = require('./helpers/deployMockContract')
const PrizePool = require('../build/PrizePool.json')
const { getEvents } = require('./helpers/getEvents')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:MultipleWinnersBuilder.test')

describe('MultipleWinnersBuilder', () => {

  let wallet

  let builder

  let trustedForwarder,
      controlledTokenBuilder,
      rngServiceMock,
      prizePool

  let multipleWinnersConfig

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()
    await deployments.fixture()
    builder = await buidler.ethers.getContractAt(
      "MultipleWinnersBuilder",
      (await deployments.get("MultipleWinnersBuilder")).address,
      wallet
    )

    trustedForwarder = (await deployments.get("TrustedForwarder"))
    multipleWinnersProxyFactory = (await deployments.get("MultipleWinnersProxyFactory"))
    controlledTokenBuilder = (await deployments.get("ControlledTokenBuilder"))
    rngServiceMock = (await deployments.get("RNGServiceMock"))

    prizePool = await deployMockContract(wallet, PrizePool.abi)

    multipleWinnersConfig = {
      rngService: rngServiceMock.address,
      prizePeriodStart: 20,
      prizePeriodSeconds: 10,
      ticketName: "Ticket",
      ticketSymbol: "TICK",
      sponsorshipName: "Sponsorship",
      sponsorshipSymbol: "SPON",
      ticketCreditLimitMantissa: toWei('0.1'),
      ticketCreditRateMantissa: toWei('0.001'),
      numberOfWinners: 1
    }
  })

  describe('initialize()', () => {
    it('should setup all factories', async () => {
      expect(await builder.multipleWinnersProxyFactory()).to.equal(multipleWinnersProxyFactory.address)
      expect(await builder.trustedForwarder()).to.equal(trustedForwarder.address)
      expect(await builder.controlledTokenBuilder()).to.equal(controlledTokenBuilder.address)
    })
  })

  describe('createMultipleWinners()', () => {
    it('should allow a user to create a new strategy', async () => {

      debug('creating...')
      let tx = await builder.createMultipleWinners(
        prizePool.address,
        multipleWinnersConfig,
        8,
        wallet._address
      )
      let events = await getEvents(builder, tx)
      let multipleWinnersCreatedEvent = events.find(e => e.name == 'MultipleWinnersCreated')

      debug(`Getting contract at ${multipleWinnersCreatedEvent.args.prizeStrategy}...`)

      const prizeStrategy = await buidler.ethers.getContractAt('MultipleWinnersHarness', multipleWinnersCreatedEvent.args.prizeStrategy, wallet)

      const ticketAddress = await prizeStrategy.ticket()
      const sponsorshipAddress = await prizeStrategy.sponsorship()

      expect(ticketAddress).to.not.be.undefined
      expect(sponsorshipAddress).to.not.be.undefined

      expect(await prizeStrategy.prizePeriodStartedAt()).to.equal(multipleWinnersConfig.prizePeriodStart)
      expect(await prizeStrategy.prizePeriodSeconds()).to.equal(multipleWinnersConfig.prizePeriodSeconds)
      expect(await prizeStrategy.owner()).to.equal(wallet._address)
      expect(await prizeStrategy.rng()).to.equal(multipleWinnersConfig.rngService)
      expect(await prizeStrategy.numberOfWinners()).to.equal(multipleWinnersConfig.numberOfWinners)

      const ticket = await buidler.ethers.getContractAt('Ticket', ticketAddress, wallet)
      expect(await ticket.name()).to.equal(multipleWinnersConfig.ticketName)
      expect(await ticket.symbol()).to.equal(multipleWinnersConfig.ticketSymbol)

      const sponsorship = await buidler.ethers.getContractAt('ControlledToken', sponsorshipAddress, wallet)
      expect(await sponsorship.name()).to.equal(multipleWinnersConfig.sponsorshipName)
      expect(await sponsorship.symbol()).to.equal(multipleWinnersConfig.sponsorshipSymbol)
    })
  })
})
