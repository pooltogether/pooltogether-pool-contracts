const { deployContract } = require('ethereum-waffle')
const { deploy1820 } = require('deploy-eip-1820')
const PeriodicPrizePoolFactory = require('../build/PeriodicPrizePoolFactory.json')
const RNGBlockhash = require('../build/RNGBlockhash.json')
const CompoundYieldServiceFactory = require('../build/CompoundYieldServiceFactory.json')
const CompoundYieldServiceBuilder = require('../build/CompoundYieldServiceBuilder.json')
const Forwarder = require('../build/Forwarder.json')
const PrizePoolBuilder = require('../build/PrizePoolBuilder.json')
const SingleRandomWinnerPrizePoolBuilder = require('../build/SingleRandomWinnerPrizePoolBuilder.json')
const LoyaltyFactory = require('../build/LoyaltyFactory.json')
const SponsorshipFactory = require('../build/SponsorshipFactory.json')
const TicketFactory = require('../build/TicketFactory.json')
const ControlledTokenFactory = require('../build/ControlledTokenFactory.json')
const SingleRandomWinnerPrizeStrategyFactory = require('../build/SingleRandomWinnerPrizeStrategyFactory.json')
const CTokenMock = require('../build/CTokenMock.json')
const ERC20Mintable = require('../build/ERC20Mintable.json')
const { expect } = require('chai')
const { increaseTime } = require('./helpers/increaseTime')
const { ethers } = require('./helpers/ethers')
const { Provider } = require('ethers/providers')
const buidler = require('./helpers/buidler')
const { Contract } = require('ethers')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:Integration.test')

describe('Integration Test', () => {
  
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

  let prizePool
  let ticket

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
