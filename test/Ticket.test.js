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

const debug = require('debug')('ptv3:Ticket.test')

const FORWARDER = '0x5f48a3371df0F8077EC741Cc2eB31c84a4Ce332a'

let overrides = { gasLimit: 20000000 }

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('Ticket contract', function() {

  let ticket

  let wallet

  let registry, prizePool, loyalty, yieldService, manager

  let lastTxTimestamp

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
    let tx = await manager.enableModule(ticket.address)
    let block = await buidler.ethers.provider.getBlock(tx.blockNumber)
    lastTxTimestamp = block.timestamp

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
      await token.mock.allowance.returns(0)
      await token.mock.approve.returns(true)
      await yieldService.mock.supply.withArgs(ticket.address, amount).returns()
      await loyalty.mock.supply.withArgs(wallet._address, amount).returns()

      await ticket.mintTickets(toWei('10'), [])

      expect(await ticket.balanceOf(wallet._address)).to.equal(amount)
    })
  })

  describe('operatorMintTickets()', () => {
    it('should create tickets', async () => {
      let amount = toWei('10')

      await token.mock.allowance.returns(0)
      await token.mock.approve.returns(true)
      await token.mock.transferFrom.withArgs(wallet._address, ticket.address, amount).returns(true)
      await yieldService.mock.supply.withArgs(ticket.address, amount).returns()
      await loyalty.mock.supply.withArgs(wallet2._address, amount).returns()

      await ticket.operatorMintTickets(wallet2._address, toWei('10'), [], [])

      expect(await ticket.balanceOf(wallet._address)).to.equal('0')
      expect(await ticket.balanceOf(wallet2._address)).to.equal(amount)
    })
  })

  describe('redeemTicketsInstantly()', () => {
    it('should allow a user to pay to redeem their tickets', async () => {
      await ticket.mint(wallet._address, toWei('10'))
    })
  })

  describe('redeemTicketsWithTimelock()', () => {
    it('should lock the users funds', async () => {
      await ticket.mint(wallet._address, toWei('10'))

      // unlock timestamp is in future
      let unlockTimestamp = lastTxTimestamp + 100
      await prizePool.mock.calculateUnlockTimestamp.returns(unlockTimestamp)
      // current timelocked balance is zero
      await timelock.mock.balanceOf.withArgs(wallet._address).returns('0')

      // expect a mint on the timelock
      await timelock.mock.mintTo.withArgs(wallet._address, toWei('10'), unlockTimestamp).returns()

      await ticket.redeemTicketsWithTimelock(toWei('10'), [])

      expect(await ticket.balanceOf(wallet._address)).to.equal(toWei('0'))
    })

    it('should lock even if there is an existing timelock balance', async () => {
      await ticket.mint(wallet._address, toWei('10'))

      // unlock timestamp is in future
      let unlockTimestamp = lastTxTimestamp + 100
      await prizePool.mock.calculateUnlockTimestamp.returns(unlockTimestamp)
      // current timelocked balance is non-zero, and still locked
      await timelock.mock.balanceOf.withArgs(wallet._address).returns(toWei('10'))
      await timelock.mock.balanceAvailableAt.withArgs(wallet._address).returns(unlockTimestamp)

      // expect a mint on the timelock
      await timelock.mock.mintTo.withArgs(wallet._address, toWei('10'), unlockTimestamp).returns()

      await ticket.redeemTicketsWithTimelock(toWei('10'), [])

      expect(await ticket.balanceOf(wallet._address)).to.equal(toWei('0'))
    })

    it('should sweep existing timelock balance if it can be redeemed', async () => {
      await ticket.mint(wallet._address, toWei('10'))

      let address = ethers.utils.getAddress(wallet._address)

      // unlock timestamp is in future
      let unlockTimestamp = lastTxTimestamp + 100
      await prizePool.mock.calculateUnlockTimestamp.returns(unlockTimestamp)

      // current timelocked balance is non-zero, and still locked
      await timelock.mock.balanceOf.withArgs(wallet._address).returns(toWei('43'))
      await timelock.mock.balanceAvailableAt.withArgs(wallet._address).returns(lastTxTimestamp)

      debug({ timelock: timelock.mock })

      // expect a timelock burn
      await timelock.mock.burnFrom.withArgs(wallet._address, toWei('43')).returns()

      // expect a mint on the timelock
      await timelock.mock.mintTo.withArgs(address, toWei('10'), unlockTimestamp).returns()

      // expect a sweep of the old funds
      await yieldService.mock.redeem.withArgs(wallet._address, toWei('43')).returns()

      await ticket.redeemTicketsWithTimelock(toWei('10'), [])

      expect(await ticket.balanceOf(wallet._address)).to.equal(toWei('0'))
    })

    it('should instantly redeem funds if unlockBlock is now or in the past', async () => {
      await ticket.mint(wallet._address, toWei('10'))

      // unlock timestamp is in past
      await prizePool.mock.calculateUnlockTimestamp.returns(lastTxTimestamp)

      // Ticket queries the timelock
      await timelock.mock.balanceOf.withArgs(wallet._address).returns(toWei('43'))
      await timelock.mock.balanceAvailableAt.withArgs(wallet._address).returns(lastTxTimestamp)

      // The timelocked tokens are burned
      await timelock.mock.burnFrom.withArgs(wallet._address, toWei('43')).returns()

      // The total funds are swept
      await yieldService.mock.redeem.withArgs(wallet._address, toWei('53')).returns()

      await ticket.redeemTicketsWithTimelock(toWei('10'), [])

      expect(await ticket.balanceOf(wallet._address)).to.equal(toWei('0'))
    })

    it('should not allow a user to redeem more than they have', async () => {
      await ticket.mint(wallet._address, toWei('10'))
      await expect(ticket.redeemTicketsWithTimelock(toWei('20'), [])).to.be.revertedWith('Insufficient balance')
    })
  })
});
