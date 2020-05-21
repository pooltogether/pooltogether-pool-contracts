const { deployContract } = require('ethereum-waffle')
const { deploy1820 } = require('deploy-eip-1820')
const PeriodicPrizePoolFactory = require('../build/PeriodicPrizePoolFactory.json')
const RNGBlockhash = require('../build/RNGBlockhash.json')
const Forwarder = require('../build/Forwarder.json')
const CompoundYieldServiceFactory = require('../build/CompoundYieldServiceFactory.json')
const CompoundYieldServiceBuilder = require('../build/CompoundYieldServiceBuilder.json')
const PrizePoolBuilder = require('../build/PrizePoolBuilder.json')
const LoyaltyFactory = require('../build/LoyaltyFactory.json')
const SingleRandomWinnerPrizePoolBuilder = require('../build/SingleRandomWinnerPrizePoolBuilder.json')
const TicketFactory = require('../build/TicketFactory.json')
const SponsorshipFactory = require('../build/SponsorshipFactory.json')
const ControlledTokenFactory = require('../build/ControlledTokenFactory.json')
const SingleRandomWinnerPrizeStrategyFactory = require('../build/SingleRandomWinnerPrizeStrategyFactory.json')
const CTokenMock = require('../build/CTokenMock.json')
const ERC20Mintable = require('../build/ERC20Mintable.json')
const { expect } = require('chai')
const { ethers } = require('./helpers/ethers')
const { Provider } = require('ethers/providers')
const buidler = require('./helpers/buidler')

const debug = require('debug')('ptv3:SingleRandomWinnerPrizePoolBuilder.test')

describe('SingleRandomWinnerPrizePoolBuilder contract', () => {
  
  let token
  let cToken

  let wallet
  let allocator
  let otherWallet

  let yieldServiceFactory
  let prizePoolFactory
  let ticketFactory
  let sponsorshipFactory
  let controlledTokenFactory
  let prizeStrategyFactory
  let prizePoolBuilder
  let singleRandomWinnerPrizePoolBuilder
  let compoundYieldServiceBuilder
  let rng
  let forwarder

  let provider

  let overrides = { gasLimit: 20000000 }

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider

    await deploy1820(wallet)

    debug('beforeEach deploy rng, forwarder etc...')

    rng = await deployContract(wallet, RNGBlockhash, [])
    forwarder = await deployContract(wallet, Forwarder, [])
    token = await deployContract(wallet, ERC20Mintable, [])
    cToken = await deployContract(wallet, CTokenMock, [
      token.address, ethers.utils.parseEther('0.01')
    ])

    debug('1')

    yieldServiceFactory = await deployContract(wallet, CompoundYieldServiceFactory, [])
    await yieldServiceFactory.initialize()

    debug('2')

    prizePoolFactory = await deployContract(wallet, PeriodicPrizePoolFactory, [], overrides)

    await prizePoolFactory.initialize()

    debug('3')

    controlledTokenFactory = await deployContract(wallet, ControlledTokenFactory, [])
    await controlledTokenFactory.initialize()
    
    debug('4')

    ticketFactory = await deployContract(wallet, TicketFactory, [], overrides)
    await ticketFactory.initialize()
    
    debug('5')

    prizeStrategyFactory = await deployContract(wallet, SingleRandomWinnerPrizeStrategyFactory, [])
    await prizeStrategyFactory.initialize()
    
    debug('6')

    compoundYieldServiceBuilder = await deployContract(wallet, CompoundYieldServiceBuilder, [])
    await compoundYieldServiceBuilder.initialize(
      yieldServiceFactory.address
    )

    debug('7')

    let loyaltyFactory = await deployContract(wallet, LoyaltyFactory, [])
    await loyaltyFactory.initialize()
    sponsorshipFactory = await deployContract(wallet, SponsorshipFactory, [])
    await sponsorshipFactory.initialize()

    debug('8')

    prizePoolBuilder = await deployContract(wallet, PrizePoolBuilder, [])
    await prizePoolBuilder.initialize(
      compoundYieldServiceBuilder.address,
      prizePoolFactory.address,
      ticketFactory.address,
      sponsorshipFactory.address,
      rng.address,
      forwarder.address
    )
    
    debug('9')

    singleRandomWinnerPrizePoolBuilder = await deployContract(wallet, SingleRandomWinnerPrizePoolBuilder, [])
    await singleRandomWinnerPrizePoolBuilder.initialize(
      prizePoolBuilder.address,
      prizeStrategyFactory.address
    )
  })

  describe('createSingleRandomWinnerPrizePool()', () => {
    it('should create a new prize pool', async () => {
      let tx = await singleRandomWinnerPrizePoolBuilder.createSingleRandomWinnerPrizePool(cToken.address, 10, 'Ticket', 'TICK', 'Sponsorship', 'SPON')

      let receipt = await provider.getTransactionReceipt(tx.hash)

      // @ts-ignore
      expect(receipt.logs.length).to.gt(2)
      
      // @ts-ignore
      let secondToLastLog = receipt.logs[receipt.logs.length - 2]
      // @ts-ignore
      let lastLog = receipt.logs[receipt.logs.length - 1]

      let prizePoolCreatedEvent = prizePoolBuilder.interface.events.PrizePoolCreated.decode(secondToLastLog.data, secondToLastLog.topics)
      let singleRandomWinnerCreatedEvent = singleRandomWinnerPrizePoolBuilder.interface.events.SingleRandomWinnerPrizePoolCreated.decode(lastLog.data, lastLog.topics)

      expect(singleRandomWinnerCreatedEvent.creator).to.equal(wallet._address)
      expect(singleRandomWinnerCreatedEvent.prizePool).to.equal(prizePoolCreatedEvent.prizePool)

      debug(`loading up CompoundYieldService...`)

      let yieldService = await buidler.ethers.getContractAt('CompoundYieldService', prizePoolCreatedEvent.yieldService, wallet)
      expect(await yieldService.token()).to.equal(token.address)

      debug(`loading up PeriodicPrizePool...`)

      let prizePool = await buidler.ethers.getContractAt('PeriodicPrizePool', prizePoolCreatedEvent.prizePool, wallet)
      expect(await prizePool.yieldService()).to.equal(yieldService.address)
    })
  })
})
