import { deployContract } from 'ethereum-waffle'
import { deploy1820 } from 'deploy-eip-1820'
import PeriodicPrizePoolFactory from '../build/PeriodicPrizePoolFactory.json'
import RNGBlockhash from '../build/RNGBlockhash.json'
import CompoundYieldServiceFactory from '../build/CompoundYieldServiceFactory.json'
import CompoundYieldServiceBuilder from '../build/CompoundYieldServiceBuilder.json'
import Forwarder from '../build/Forwarder.json'
import PrizePoolBuilder from '../build/PrizePoolBuilder.json'
import SingleRandomWinnerPrizePoolBuilder from '../build/SingleRandomWinnerPrizePoolBuilder.json'
import LoyaltyFactory from '../build/LoyaltyFactory.json'
import SponsorshipFactory from '../build/SponsorshipFactory.json'
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
  let sponsorshipFactory: any
  let controlledTokenFactory: any
  let prizeStrategyFactory: any
  let prizePoolBuilder: any
  let singleRandomWinnerPrizePoolBuilder: any
  let compoundYieldServiceBuilder: any
  let rng: any
  let forwarder: any

  let provider: Provider

  let prizePool: Contract
  let ticket: Contract

  let overrides = { gasLimit: 40000000 }

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider

    debug('5')

    await deploy1820(wallet)

    debug('6')

    rng = await deployContract(wallet, RNGBlockhash, [], overrides)
    forwarder = await deployContract(wallet, Forwarder, [], overrides)
    token = await deployContract(wallet, ERC20Mintable, [], overrides)
    cToken = await deployContract(wallet, CTokenMock, [
      token.address, ethers.utils.parseEther('0.01')
    ])

    debug('7')

    yieldServiceFactory = await deployContract(wallet, CompoundYieldServiceFactory, [], overrides)

    debug('7.1')

    await yieldServiceFactory.initialize(overrides)

    debug('7.2')

    prizePoolFactory = await deployContract(wallet, PeriodicPrizePoolFactory, [], overrides)
    await prizePoolFactory.initialize(overrides)
    
    debug('6')

    compoundYieldServiceBuilder = await deployContract(wallet, CompoundYieldServiceBuilder, [], overrides)
    await compoundYieldServiceBuilder.initialize(
      yieldServiceFactory.address
    )

    debug('7')

    let loyaltyFactory = await deployContract(wallet, LoyaltyFactory, [], overrides)
    await loyaltyFactory.initialize()
    sponsorshipFactory = await deployContract(wallet, SponsorshipFactory, [], overrides)
    await sponsorshipFactory.initialize(
      loyaltyFactory.address
    )

    debug('8')

    controlledTokenFactory = await deployContract(wallet, ControlledTokenFactory, [], overrides)
    await controlledTokenFactory.initialize()
    
    debug('8.1')

    ticketFactory = await deployContract(wallet, TicketFactory, [], overrides)
    await ticketFactory.initialize(controlledTokenFactory.address, overrides)

    debug('8.2')

    prizeStrategyFactory = await deployContract(wallet, SingleRandomWinnerPrizeStrategyFactory, [], overrides)
    await prizeStrategyFactory.initialize()

    debug('8.3')

    compoundYieldServiceBuilder = await deployContract(wallet, CompoundYieldServiceBuilder, [], overrides)
    await compoundYieldServiceBuilder.initialize(
      yieldServiceFactory.address
    )

    debug('9')

    prizePoolBuilder = await deployContract(wallet, PrizePoolBuilder, [], overrides)
    await prizePoolBuilder.initialize(
      compoundYieldServiceBuilder.address,
      prizePoolFactory.address,
      ticketFactory.address,
      sponsorshipFactory.address,
      rng.address,
      forwarder.address
    )
    
    debug('10')

    singleRandomWinnerPrizePoolBuilder = await deployContract(wallet, SingleRandomWinnerPrizePoolBuilder, [], overrides)
    await singleRandomWinnerPrizePoolBuilder.initialize(
      prizePoolBuilder.address,
      prizeStrategyFactory.address
    )

    debug('11')

    let tx = await singleRandomWinnerPrizePoolBuilder.createSingleRandomWinnerPrizePool(cToken.address, 10, 'Ticket', 'TICK', 'Sponsorship', 'SPON', overrides)
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
      await token.approve(ticket.address, toWei('100'))
      await ticket.mintTickets(toWei('100'))
      await cToken.accrueCustom(toWei('22'))

      debug('First award...')

      await increaseTime(10)
      
      debug('starting award...')

      await prizePool.startAward()

      debug('completing award...')

      await prizePool.completeAward()

      debug('completed award')

      expect(await ticket.balanceOf(wallet._address)).to.equal(toWei('122'))

      let balanceBeforeWithdrawal = await token.balanceOf(wallet._address)

      debug('Redeem tickets with timelock...')

      await ticket.redeemTicketsWithTimelock(toWei('122'))

      debug('Second award...')

      await increaseTime(10)
      await prizePool.startAward()
      await prizePool.completeAward()

      debug('Sweep timelocked funds...')

      await ticket.sweepTimelock([wallet._address])

      let balanceAfterWithdrawal = await token.balanceOf(wallet._address)

      expect(balanceAfterWithdrawal.sub(balanceBeforeWithdrawal)).to.equal(toWei('122'))
    })

    it('should support instant redemption', async () => {
      debug('Minting tickets...')
      await token.approve(ticket.address, toWei('100'))
      await ticket.mintTickets(toWei('100'))

      debug('accruing...')

      await cToken.accrueCustom(toWei('22'))

      await increaseTime(4)

      let balanceBeforeWithdrawal = await token.balanceOf(wallet._address)

      await ticket.redeemTicketsInstantly(toWei('100'))

      let balanceAfterWithdrawal = await token.balanceOf(wallet._address)

      // no previous prize, so withdrawal costs zero
      expect(balanceAfterWithdrawal.sub(balanceBeforeWithdrawal)).to.equal(toWei('100'))
    })

    it('should take a fee when instantly redeeming after a prize', async () => {
      debug('Minting tickets...')
      await token.approve(ticket.address, toWei('100'))
      await ticket.mintTickets(toWei('100'))
      await cToken.accrueCustom(toWei('22'))

      await increaseTime(10)
      await prizePool.startAward()
      await prizePool.completeAward()

      let balanceBeforeWithdrawal = await token.balanceOf(wallet._address)

      await ticket.redeemTicketsInstantly(toWei('100'))

      let balanceAfterWithdrawal = await token.balanceOf(wallet._address)

      // no previous prize, so withdrawal costs zero
      let difference = balanceAfterWithdrawal.sub(balanceBeforeWithdrawal)
      expect(difference.lt(toWei('100'))).to.be.true
    })
  })
})
