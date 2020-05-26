const { deployContract, deployMockContract } = require('ethereum-waffle')
const { deploy1820 } = require('deploy-eip-1820')
const TicketHarness = require('../build/TicketHarness.json')
const PeriodicPrizePool = require('../build/PeriodicPrizePool.json')
const Timelock = require('../build/Timelock.json')
const IERC20 = require('../build/IERC20.json')
const { deployMockModule } = require('../js/deployMockModule')
const Loyalty = require('../build/Loyalty.json')
const CompoundYieldService = require('../build/CompoundYieldService.json')
const {
  LOYALTY_INTERFACE_HASH,
  PRIZE_POOL_INTERFACE_HASH,
  TICKET_INTERFACE_HASH,
  TIMELOCK_INTERFACE_HASH,
  YIELD_SERVICE_INTERFACE_HASH
} = require('../js/constants')

const ModuleManagerHarness = require('../build/ModuleManagerHarness.json')
const { ethers } = require('./helpers/ethers')
const { expect } = require('chai')
const buidler = require('./helpers/buidler')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:Loyalty.test')

const FORWARDER = '0x5f48a3371df0F8077EC741Cc2eB31c84a4Ce332a'

let overrides = { gasLimit: 20000000 }

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('Loyalty contract', function() {

  let ticket

  let wallet

  let registry, prizePool, loyalty, yieldService, manager

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()

    debug(`using wallet ${wallet._address}`)

    debug('creating manager and registry...')

    manager = await deployContract(wallet, ModuleManagerHarness, [], overrides)
    await manager.initialize()
    registry = await deploy1820(wallet)

    debug('deploying periodic prize pool...')

    prizePool = await deployMockModule(wallet, manager, PeriodicPrizePool.abi, PRIZE_POOL_INTERFACE_HASH)

    debug('deploying loyalty...')

    loyalty = await deployMockModule(wallet, manager, Loyalty.abi, LOYALTY_INTERFACE_HASH)

    debug('deploying yieldService...')

    yieldService = await deployMockModule(wallet, manager, CompoundYieldService.abi, YIELD_SERVICE_INTERFACE_HASH)

    debug('deploying timelock...')

    timelock = await deployMockModule(wallet, manager, Timelock.abi, TIMELOCK_INTERFACE_HASH)

    debug('deploying token...')

    token = await deployMockContract(wallet, IERC20.abi, overrides)

    ticket = await deployContract(wallet, TicketHarness, [], overrides)
    await manager.enableModule(ticket.address)

    await yieldService.mock.token.returns(token.address)
    await token.mock.approve.returns(true)

    await ticket['initialize(address,address,string,string)'](
      manager.address,
      FORWARDER,
      'TICKET',
      'TICK'
    )
  })

  describe('initialize()', () => {
    it('should set the params', async () => {
      expect(await ticket.name()).to.equal('TICKET')
      expect(await ticket.symbol()).to.equal('TICK')
      expect(await ticket.getTrustedForwarder()).to.equal(FORWARDER)
      expect(await registry.getInterfaceImplementer(manager.address, TICKET_INTERFACE_HASH)).to.equal(ticket.address)
    })
  })

  describe('mintTickets()', () => {
    it('should create tickets', async () => {
      let amount = toWei('10')

      await token.mock.transferFrom.withArgs(wallet._address, ticket.address, amount).returns(true)
      await yieldService.mock.supply.withArgs(ticket.address, amount).returns()
      await loyalty.mock.supply.withArgs(wallet._address, amount).returns()

      await ticket.mintTickets(toWei('10'))

      expect(await ticket.balanceOf(wallet._address)).to.equal(amount)
    })
  })

  describe('operatorMintTickets()', () => {
    it('should create tickets', async () => {
      let amount = toWei('10')

      await token.mock.transferFrom.withArgs(wallet._address, ticket.address, amount).returns(true)
      await yieldService.mock.supply.withArgs(ticket.address, amount).returns()
      await loyalty.mock.supply.withArgs(wallet2._address, amount).returns()

      await ticket.operatorMintTickets(wallet2._address, toWei('10'))

      expect(await ticket.balanceOf(wallet._address)).to.equal('0')
      expect(await ticket.balanceOf(wallet2._address)).to.equal(amount)
    })
  })

  describe('redeemTicketsInstantly()', () => {
    it('should allow a user to pay to redeem their tickets', async () => {
      await ticket.mint(wallet._address, toWei('10'))
    })
  })

  // describe('redeemTicketsWithTimelock()', () => {
  //   it('should lock the users funds', async () => {
  //     debug('minting tickets...')
  //     await token.approve(ticket.address, toWei('10'))
  //     await ticket.mintTickets(toWei('10'))

  //     let startedAt = await prizePool.prizePeriodStartedAt()
  //     const unlockTimestamp = startedAt.toNumber() + 10
  //     expect(await prizePool.prizePeriodEndAt()).to.equal(unlockTimestamp)

  //     let testTimestamp = await prizePool.calculateUnlockTimestamp(wallet._address, toWei('10'));

  //     expect(testTimestamp).to.equal(unlockTimestamp)

  //     debug('redeem tickets with timelock...')

  //     await ticket.redeemTicketsWithTimelock(toWei('10'))

  //     // Tickets are burned
  //     expect(await ticket.balanceOf(wallet._address)).to.equal('0')
      
  //     debug('check timelock...', timelock.address)

  //     // Locked balance is recorded
  //     expect(await timelock.balanceAvailableAt(wallet._address)).to.equal(unlockTimestamp)
  //     expect(await timelock.balanceOf(wallet._address)).to.equal(toWei('10'))
  //   })

  //   it('should instantly redeem funds if unlockBlock is now or in the past', async () => {
  //     await token.approve(ticket.address, toWei('10'))
  //     let tx = await ticket.mintTickets(toWei('10'))

  //     // way beyond prize end
  //     await increaseTime(20)

  //     let userBalance = await token.balanceOf(wallet._address)
  //     tx = await ticket.redeemTicketsWithTimelock(toWei('4'))
  //     // Tickets are transferred
  //     expect((await token.balanceOf(wallet._address)).sub(userBalance)).to.equal(toWei('4'))
  //     expect(await timelock.balanceOf(wallet._address)).to.equal('0')
  //     expect(await timelock.balanceAvailableAt(wallet._address)).to.equal('0')
  //   })

  //   it('should sweep old locked deposits', async () => {
  //     // create tickets
  //     await token.approve(ticket.address, toWei('10'))
  //     await ticket.mintTickets(toWei('10'))

  //     // mark balance less tickets
  //     let userBalance = await token.balanceOf(wallet._address)

  //     // now redeem tickets
  //     await ticket.redeemTicketsWithTimelock(toWei('4'))

  //     // tickets should be burned
  //     expect(await ticket.balanceOf(wallet._address)).to.equal(toWei('6'))
    
  //     // now let's progress time so that the previous funds are unlocked
  //     await increaseTime(20)

  //     // redeem again
  //     await ticket.redeemTicketsWithTimelock(toWei('6'))

  //     // Remaining tickets are burned
  //     expect(await ticket.balanceOf(wallet._address)).to.equal(toWei('0'))

  //     // All tokens should have been transferred
  //     expect((await token.balanceOf(wallet._address)).sub(userBalance)).to.equal(toWei('10'))

  //     // Locked balance is recorded
  //     expect(await timelock.balanceOf(wallet._address)).to.equal(toWei('0'))
  //   })
  // })

});
