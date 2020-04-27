import { deployContract } from 'ethereum-waffle'
import PrizePoolFactory from '../build/PrizePoolFactory.json'
import InterestPoolFactory from '../build/InterestPoolFactory.json'
import TicketPoolFactory from '../build/TicketPoolFactory.json'
import TicketFactory from '../build/TicketFactory.json'
import ControlledTokenFactory from '../build/ControlledTokenFactory.json'
import PrizeStrategyFactory from '../build/PrizeStrategyFactory.json'
import CTokenMock from '../build/CTokenMock.json'
import ERC20Mintable from '../build/ERC20Mintable.json'
import SingleRandomWinnerPrizeStrategy from '../build/SingleRandomWinnerPrizeStrategy.json'
import Ticket from '../build/Ticket.json'
import ControlledToken from '../build/ControlledToken.json'
import { expect } from 'chai'
import { ethers, Contract } from 'ethers'
import { deploy1820 } from 'deploy-eip-1820'

import { Provider } from 'ethers/providers'

const buidler = require("@nomiclabs/buidler")

const toWei = ethers.utils.parseEther

describe('PrizePoolFactory contract', () => {
  
  let ticket: Contract
  let mockInterestPool: Contract
  let mockTicketPool: Contract
  let prizeStrategy: Contract
  let collateralToken: Contract
  let token: Contract
  let cToken: Contract

  let wallet: any
  let allocator: any
  let otherWallet: any
  let prizePeriodStart: any

  let prizePeriod = 10

  let interestPoolFactory: any
  let ticketPoolFactory: any
  let ticketFactory: any
  let controlledTokenFactory: any
  let prizeStrategyFactory: any
  let prizePoolFactory: any

  let provider: Provider

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider

    token = await deployContract(wallet, ERC20Mintable, [])
    cToken = await deployContract(wallet, CTokenMock, [])    
    await cToken.initialize(token.address, ethers.utils.parseEther('0.01'))

    interestPoolFactory = await deployContract(wallet, InterestPoolFactory, [])
    await interestPoolFactory.initialize()

    ticketPoolFactory = await deployContract(wallet, TicketPoolFactory, [], { gasLimit: 20000000 })

    await ticketPoolFactory.initialize()

    ticketFactory = await deployContract(wallet, TicketFactory, [])
    await ticketFactory.initialize()
    controlledTokenFactory = await deployContract(wallet, ControlledTokenFactory, [])
    await controlledTokenFactory.initialize()
    prizeStrategyFactory = await deployContract(wallet, PrizeStrategyFactory, [])
    await prizeStrategyFactory.initialize()
    
    prizePoolFactory = await deployContract(wallet, PrizePoolFactory, [])
    await prizePoolFactory.initialize(
      interestPoolFactory.address,
      ticketPoolFactory.address,
      ticketFactory.address,
      controlledTokenFactory.address,
      prizeStrategyFactory.address
    )
  })

  describe('createPrizePool()', () => {
    it('should create a new prize pool', async () => {
      let tx = await prizePoolFactory.createSingleRandomWinnerTicketPool(cToken.address, 10, 'Sponsorship', 'SPON', 'Ticket', 'TICK')

      let receipt = await provider.getTransactionReceipt(tx.hash)
      // @ts-ignore
      let lastLog = receipt.logs[receipt.logs.length - 1]

      let event = prizePoolFactory.interface.events.PrizePoolCreated.decode(lastLog.data, lastLog.topics)

      // console.log({ event })

      let interestPool = await buidler.ethers.getContractAt('InterestPool', event.interestPool, wallet)

      expect(await interestPool.underlying()).to.equal(token.address)

      let ticketPool = await buidler.ethers.getContractAt('TicketPool', event.ticketPool, wallet)
      expect(await ticketPool.interestPool()).to.equal(interestPool.address)

      let prizeStrategy = await buidler.ethers.getContractAt('SingleRandomWinnerPrizeStrategy', event.prizeStrategy, wallet)
      expect(await prizeStrategy.ticketPool()).to.equal(ticketPool.address)
    })
  })
})
