import { deployContract } from 'ethereum-waffle'
import { deploy1820 } from 'deploy-eip-1820'
import PeriodicPrizePoolFactory from '../build/PeriodicPrizePoolFactory.json'
import RNGBlockhash from '../build/RNGBlockhash.json'
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
import { increaseTime } from './helpers/increaseTime'
import { ethers } from './helpers/ethers'
import { Provider } from 'ethers/providers'
import buidler from './helpers/buidler'
import { Contract } from 'ethers'

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:Integration.test')

describe('Integration Test', () => {
  
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

  let provider: Provider

  let prizePool: Contract
  let ticket: Contract
  let yieldService: Contract

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider

    await deploy1820(wallet)

    rng = await deployContract(wallet, RNGBlockhash, [])

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
      rng.address
    )

    singleRandomWinnerPrizePoolBuilder = await deployContract(wallet, SingleRandomWinnerPrizePoolBuilder, [])
    await singleRandomWinnerPrizePoolBuilder.initialize(
      prizePoolBuilder.address,
      prizeStrategyFactory.address
    )

    let tx = await singleRandomWinnerPrizePoolBuilder.createSingleRandomWinnerPrizePool(cToken.address, 10, 'Ticket', 'TICK', 'Sponsorship', 'SPON')
    let receipt = await provider.getTransactionReceipt(tx.hash)
    // @ts-ignore
    let lastLog = receipt.logs[receipt.logs.length - 1]
    let singleRandomWinnerCreatedEvent = singleRandomWinnerPrizePoolBuilder.interface.events.SingleRandomWinnerPrizePoolCreated.decode(lastLog.data, lastLog.topics)

    prizePool = await buidler.ethers.getContractAt('PeriodicPrizePool', singleRandomWinnerCreatedEvent.prizePool, wallet)
    ticket = await buidler.ethers.getContractAt('Ticket', await prizePool.ticket(), wallet)

    await token.mint(wallet._address, toWei('1000000'))
  })

  describe('Mint tickets', () => {
    it('should support timelocked withdrawals', async () => {
      debug('Minting tickets...')
      await token.approve(prizePool.address, toWei('100'))
      await prizePool.mintTickets(toWei('100'))
      await cToken.accrueCustom(toWei('22'))

      debug('First award...')

      await increaseTime(10)
      await prizePool.startAward()
      await prizePool.completeAward()

      expect(await ticket.balanceOf(wallet._address)).to.equal(toWei('122'))

      let balanceBeforeWithdrawal = await token.balanceOf(wallet._address)

      debug('Redeem tickets with timelock...')

      await prizePool.redeemTicketsWithTimelock(toWei('122'))

      debug('Second award...')

      await increaseTime(10)
      await prizePool.startAward()
      await prizePool.completeAward()

      debug('Sweep timelocked funds...')

      await prizePool.sweepTimelockFunds([wallet._address])

      let balanceAfterWithdrawal = await token.balanceOf(wallet._address)

      expect(balanceAfterWithdrawal.sub(balanceBeforeWithdrawal)).to.equal(toWei('122'))
    })

    it('should support instant redemption', async () => {
      debug('Minting tickets...')
      await token.approve(prizePool.address, toWei('100'))
      await prizePool.mintTickets(toWei('100'))
      await cToken.accrueCustom(toWei('22'))

      await increaseTime(4)

      let balanceBeforeWithdrawal = await token.balanceOf(wallet._address)

      await prizePool.redeemTicketsInstantly(toWei('100'))

      let balanceAfterWithdrawal = await token.balanceOf(wallet._address)

      // no previous prize, so withdrawal costs zero
      expect(balanceAfterWithdrawal.sub(balanceBeforeWithdrawal)).to.equal(toWei('100'))
    })

    it('should take a fee when instantly redeeming after a prize', async () => {
      debug('Minting tickets...')
      await token.approve(prizePool.address, toWei('100'))
      await prizePool.mintTickets(toWei('100'))
      await cToken.accrueCustom(toWei('22'))

      await increaseTime(10)
      await prizePool.startAward()
      await prizePool.completeAward()

      let balanceBeforeWithdrawal = await token.balanceOf(wallet._address)

      await prizePool.redeemTicketsInstantly(toWei('100'))

      let balanceAfterWithdrawal = await token.balanceOf(wallet._address)

      // no previous prize, so withdrawal costs zero
      let difference = balanceAfterWithdrawal.sub(balanceBeforeWithdrawal)
      expect(difference.lt(toWei('100'))).to.be.true
    })
  })
})
