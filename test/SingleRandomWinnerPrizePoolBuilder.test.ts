import { deployContract } from 'ethereum-waffle'
import { deploy1820 } from 'deploy-eip-1820'
import PeriodicPrizePoolFactory from '../build/PeriodicPrizePoolFactory.json'
import RNGBlockhash from '../build/RNGBlockhash.json'
import Forwarder from '../build/Forwarder.json'
import CompoundYieldServiceFactory from '../build/CompoundYieldServiceFactory.json'
import CompoundYieldServiceBuilder from '../build/CompoundYieldServiceBuilder.json'
import PrizePoolBuilder from '../build/PrizePoolBuilder.json'
import SingleRandomWinnerPrizePoolBuilder from '../build/SingleRandomWinnerPrizePoolBuilder.json'
import TicketFactory from '../build/TicketFactory.json'
import ControlledTokenFactory from '../build/ControlledTokenFactory.json'
import SingleRandomWinnerPrizeStrategyFactory from '../build/SingleRandomWinnerPrizeStrategyFactory.json'
import CTokenMock from '../build/CTokenMock.json'
import ERC20Mintable from '../build/ERC20Mintable.json'
import { expect } from 'chai'
import { ethers } from './helpers/ethers'
import { Provider } from 'ethers/providers'
import buidler from './helpers/buidler'

const debug = require('debug')('ptv3:SingleRandomWinnerPrizePoolBuilder.test')

describe('SingleRandomWinnerPrizePoolBuilder contract', () => {
  
  let token: any
  let cToken: any

  let wallet: any
  let allocator: any
  let otherWallet: any

  let yieldServiceFactory: any
  let prizePoolFactory: any
  let ticketFactory: any
  let controlledTokenFactory: any
  let prizeStrategyFactory: any
  let prizePoolBuilder: any
  let singleRandomWinnerPrizePoolBuilder: any
  let compoundYieldServiceBuilder: any
  let rng: any
  let forwarder: any

  let provider: Provider

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider

    await deploy1820(wallet)

    rng = await deployContract(wallet, RNGBlockhash, [])
    forwarder = await deployContract(wallet, Forwarder, [])
    token = await deployContract(wallet, ERC20Mintable, [])
    cToken = await deployContract(wallet, CTokenMock, [
      token.address, ethers.utils.parseEther('0.01')
    ])

    yieldServiceFactory = await deployContract(wallet, CompoundYieldServiceFactory, [])
    await yieldServiceFactory.initialize()

    prizePoolFactory = await deployContract(wallet, PeriodicPrizePoolFactory, [], { gasLimit: 20000000 })

    await prizePoolFactory.initialize()

    ticketFactory = await deployContract(wallet, TicketFactory, [])
    await ticketFactory.initialize()
    controlledTokenFactory = await deployContract(wallet, ControlledTokenFactory, [])
    await controlledTokenFactory.initialize()
    prizeStrategyFactory = await deployContract(wallet, SingleRandomWinnerPrizeStrategyFactory, [])
    await prizeStrategyFactory.initialize()

    compoundYieldServiceBuilder = await deployContract(wallet, CompoundYieldServiceBuilder, [])
    await compoundYieldServiceBuilder.initialize(
      yieldServiceFactory.address
    )

    prizePoolBuilder = await deployContract(wallet, PrizePoolBuilder, [])
    await prizePoolBuilder.initialize(
      compoundYieldServiceBuilder.address,
      prizePoolFactory.address,
      ticketFactory.address,
      controlledTokenFactory.address,
      rng.address,
      forwarder.address
    )

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
