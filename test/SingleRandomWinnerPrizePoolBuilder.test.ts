import { deployContract } from 'ethereum-waffle'
import PrizePoolFactory from '../build/PrizePoolFactory.json'
import RNGBlockhash from '../build/RNGBlockhash.json'
import InterestPoolFactory from '../build/InterestPoolFactory.json'
import PrizePoolBuilder from '../build/PrizePoolBuilder.json'
import SingleRandomWinnerPrizePoolBuilder from '../build/SingleRandomWinnerPrizePoolBuilder.json'
import TicketFactory from '../build/TicketFactory.json'
import ControlledTokenFactory from '../build/ControlledTokenFactory.json'
import SingleRandomWinnerPrizeStrategyFactory from '../build/SingleRandomWinnerPrizeStrategyFactory.json'
import CTokenMock from '../build/CTokenMock.json'
import ERC20Mintable from '../build/ERC20Mintable.json'
import { expect } from 'chai'
import { ethers } from 'ethers'

import { Provider } from 'ethers/providers'

const buidler = require("@nomiclabs/buidler")

describe('SingleRandomWinnerPrizePoolBuilder contract', () => {
  
  let token: any
  let cToken: any

  let wallet: any
  let allocator: any
  let otherWallet: any

  let interestPoolFactory: any
  let prizePoolFactory: any
  let ticketFactory: any
  let controlledTokenFactory: any
  let prizeStrategyFactory: any
  let prizePoolBuilder: any
  let singleRandomWinnerPrizePoolBuilder: any
  let rng: any

  let provider: Provider

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider

    rng = await deployContract(wallet, RNGBlockhash, [])

    token = await deployContract(wallet, ERC20Mintable, [])
    cToken = await deployContract(wallet, CTokenMock, [
      token.address, ethers.utils.parseEther('0.01')
    ])

    interestPoolFactory = await deployContract(wallet, InterestPoolFactory, [])
    await interestPoolFactory.initialize()

    prizePoolFactory = await deployContract(wallet, PrizePoolFactory, [], { gasLimit: 20000000 })

    await prizePoolFactory.initialize()

    ticketFactory = await deployContract(wallet, TicketFactory, [])
    await ticketFactory.initialize()
    controlledTokenFactory = await deployContract(wallet, ControlledTokenFactory, [])
    await controlledTokenFactory.initialize()
    prizeStrategyFactory = await deployContract(wallet, SingleRandomWinnerPrizeStrategyFactory, [])
    await prizeStrategyFactory.initialize()

    prizePoolBuilder = await deployContract(wallet, PrizePoolBuilder, [])
    await prizePoolBuilder.initialize(
      interestPoolFactory.address,
      prizePoolFactory.address,
      ticketFactory.address,
      controlledTokenFactory.address,
    )

    singleRandomWinnerPrizePoolBuilder = await deployContract(wallet, SingleRandomWinnerPrizePoolBuilder, [])
    await singleRandomWinnerPrizePoolBuilder.initialize(
      prizePoolBuilder.address,
      prizeStrategyFactory.address,
      rng.address
    )
  })

  describe('createPrizePool()', () => {
    it('should create a new prize pool', async () => {
      let tx = await singleRandomWinnerPrizePoolBuilder.createSingleRandomWinnerPrizePool(cToken.address, 10, 'Sponsorship', 'SPON', 'Ticket', 'TICK')

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

      let interestPool = await buidler.ethers.getContractAt('InterestPool', prizePoolCreatedEvent.interestPool, wallet)
      expect(await interestPool.underlying()).to.equal(token.address)

      let prizePool = await buidler.ethers.getContractAt('PrizePool', prizePoolCreatedEvent.prizePool, wallet)
      expect(await prizePool.interestPool()).to.equal(interestPool.address)

      let prizeStrategy = await buidler.ethers.getContractAt('SingleRandomWinnerPrizeStrategy', prizePoolCreatedEvent.prizeStrategy, wallet)
      expect(await prizeStrategy.prizePool()).to.equal(prizePool.address)
      expect(await prizeStrategy.rng()).to.equal(rng.address)
    })
  })
})
