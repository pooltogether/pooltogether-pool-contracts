const { deployContracts } = require('../js/deployContracts')
const { expect } = require('chai')
const { increaseTime } = require('./helpers/increaseTime')
const { ethers } = require('./helpers/ethers')
const buidler = require('./helpers/buidler')
const {
  PRIZE_POOL_INTERFACE_HASH,
  TICKET_INTERFACE_HASH,
  YIELD_SERVICE_INTERFACE_HASH,
  TIMELOCK_INTERFACE_HASH
} = require('../js/constants')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:Integration.test')

describe('Integration Test', () => {
  
  let wallet
  let allocator
  let otherWallet

  let env
  let token, cToken

  let provider

  let prizePool
  let ticket
  let yieldService
  let timelock

  let overrides = { gasLimit: 40000000 }

  let prizePeriodSeconds = 10

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider

    env = await deployContracts(wallet)
    token = env.token
    cToken = env.cToken

    let tx = await env.singleRandomWinnerPrizePoolBuilder.createSingleRandomWinnerPrizePool(cToken.address, prizePeriodSeconds, 'Ticket', 'TICK', 'Sponsorship', 'SPON', overrides)
    let receipt = await provider.getTransactionReceipt(tx.hash)
    let lastLog = receipt.logs[receipt.logs.length - 1]
    let singleRandomWinnerCreatedEvent = env.singleRandomWinnerPrizePoolBuilder.interface.events.SingleRandomWinnerPrizePoolCreated.decode(lastLog.data, lastLog.topics)

    moduleManager = await buidler.ethers.getContractAt('PrizePoolModuleManager', singleRandomWinnerCreatedEvent.moduleManager, wallet)

    prizePool = await buidler.ethers.getContractAt('PeriodicPrizePool', await moduleManager.prizePool(), wallet)
    ticket = await buidler.ethers.getContractAt('Ticket', await moduleManager.ticket(), wallet)
    yieldService = await buidler.ethers.getContractAt('Timelock', await moduleManager.yieldService(), wallet)
    timelock = await buidler.ethers.getContractAt('Timelock', await moduleManager.timelock(), wallet)

    debug({ ticket: ticket.address, prizePool: prizePool.address })

    await token.mint(wallet._address, toWei('1000000'))
  })

  describe('Mint tickets', () => {
    it('should support timelocked withdrawals', async () => {
      debug('Approving token spend...')
      await token.approve(ticket.address, toWei('100'))

      debug('Minting tickets...')

      await ticket.mintTickets(toWei('50'), [], overrides)
      await ticket.mintTickets(toWei('50'), [], overrides)

      debug('Accrue custom...')

      await cToken.accrueCustom(toWei('22'))

      debug('First award...')

      await increaseTime(prizePeriodSeconds * 2)
      
      debug('starting award...')

      await prizePool.startAward()

      debug('completing award...')

      await prizePool.completeAward()

      debug('completed award')

      expect(await ticket.balanceOf(wallet._address)).to.equal(toWei('122'))
      let balanceBeforeWithdrawal = await token.balanceOf(wallet._address)

      debug('Redeem tickets with timelock...')

      await ticket.redeemTicketsWithTimelock(toWei('122'), [])

      debug('Second award...')

      await increaseTime(prizePeriodSeconds * 2)
      await prizePool.startAward()
      await prizePool.completeAward()

      debug('Sweep timelocked funds...')

      await timelock.sweep([wallet._address])

      let balanceAfterWithdrawal = await token.balanceOf(wallet._address)

      expect(balanceAfterWithdrawal.sub(balanceBeforeWithdrawal)).to.equal(toWei('122'))
    })

    it('should support instant redemption', async () => {
      debug('Minting tickets...')
      await token.approve(ticket.address, toWei('100'))
      await ticket.mintTickets(toWei('100'), [], overrides)

      debug('accruing...')

      await cToken.accrueCustom(toWei('22'))

      await increaseTime(4)

      let balanceBeforeWithdrawal = await token.balanceOf(wallet._address)

      await ticket.redeemTicketsInstantly(toWei('100'), [])

      let balanceAfterWithdrawal = await token.balanceOf(wallet._address)

      // no previous prize, so withdrawal costs zero
      expect(balanceAfterWithdrawal.sub(balanceBeforeWithdrawal)).to.equal(toWei('100'))
    })

    it('should take a fee when instantly redeeming after a prize', async () => {
      debug('Minting tickets...')
      await token.approve(ticket.address, toWei('100'))
      await ticket.mintTickets(toWei('100'), [], overrides)
      await cToken.accrueCustom(toWei('22'))

      await increaseTime(prizePeriodSeconds * 2)
      await prizePool.startAward()
      await prizePool.completeAward()

      let balanceBeforeWithdrawal = await token.balanceOf(wallet._address)

      await ticket.redeemTicketsInstantly(toWei('100'), [])

      let balanceAfterWithdrawal = await token.balanceOf(wallet._address)

      // no previous prize, so withdrawal costs zero
      let difference = balanceAfterWithdrawal.sub(balanceBeforeWithdrawal)
      expect(difference.lt(toWei('100'))).to.be.true
    })
  })
})
