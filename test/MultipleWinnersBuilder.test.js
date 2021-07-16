const { deployments } = require("hardhat");
const { expect } = require('chai')
const hardhat = require('hardhat')
const { ethers } = require('ethers')
const { deployMockContract } = require('ethereum-waffle')

const { getEvents } = require('./helpers/getEvents')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:MultipleWinnersBuilder.test')

describe('MultipleWinnersBuilder', () => {

  let wallet

  let builder

  let controlledTokenBuilder,
      rngServiceMock,
      prizePool

  let multipleWinnersConfig

  beforeEach(async () => {
    [wallet, wallet2, wallet3] = await hardhat.ethers.getSigners()
    await deployments.fixture()
    builder = await hardhat.ethers.getContractAt(
      "MultipleWinnersBuilder",
      (await deployments.get("MultipleWinnersBuilder")).address,
      wallet
    )

    multipleWinnersProxyFactory = (await deployments.get("MultipleWinnersProxyFactory"))
    controlledTokenBuilder = (await deployments.get("ControlledTokenBuilder"))
    rngServiceMock = (await deployments.get("RNGServiceMock"))

    const PrizePool = await hre.artifacts.readArtifact("PrizePool")
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
      numberOfWinners: 1,
      prizeSplits: [],
      splitExternalErc20Awards: true
    }
  })

  describe('initialize()', () => {
    it('should setup all factories', async () => {
      expect(await builder.multipleWinnersProxyFactory()).to.equal(multipleWinnersProxyFactory.address)
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
        wallet.address
      )
      let events = await getEvents(builder, tx)
      let multipleWinnersCreatedEvent = events.find(e => e.name == 'MultipleWinnersCreated')

      debug(`Getting contract at ${multipleWinnersCreatedEvent.args.prizeStrategy}...`)

      const prizeStrategy = await hardhat.ethers.getContractAt('MultipleWinnersHarness', multipleWinnersCreatedEvent.args.prizeStrategy, wallet)

      const ticketAddress = await prizeStrategy.ticket()
      const sponsorshipAddress = await prizeStrategy.sponsorship()

      expect(ticketAddress).to.not.be.undefined
      expect(sponsorshipAddress).to.not.be.undefined

      expect(await prizeStrategy.prizePeriodStartedAt()).to.equal(multipleWinnersConfig.prizePeriodStart)
      expect(await prizeStrategy.prizePeriodSeconds()).to.equal(multipleWinnersConfig.prizePeriodSeconds)
      expect(await prizeStrategy.owner()).to.equal(wallet.address)
      expect(await prizeStrategy.rng()).to.equal(multipleWinnersConfig.rngService)
      expect(await prizeStrategy.numberOfWinners()).to.equal(multipleWinnersConfig.numberOfWinners)
      expect(await prizeStrategy.splitExternalErc20Awards()).to.equal(multipleWinnersConfig.splitExternalErc20Awards)

      const ticket = await hardhat.ethers.getContractAt('Ticket', ticketAddress, wallet)
      expect(await ticket.name()).to.equal(multipleWinnersConfig.ticketName)
      expect(await ticket.symbol()).to.equal(multipleWinnersConfig.ticketSymbol)

      const sponsorship = await hardhat.ethers.getContractAt('ControlledToken', sponsorshipAddress, wallet)
      expect(await sponsorship.name()).to.equal(multipleWinnersConfig.sponsorshipName)
      expect(await sponsorship.symbol()).to.equal(multipleWinnersConfig.sponsorshipSymbol)
    })
  })
})
