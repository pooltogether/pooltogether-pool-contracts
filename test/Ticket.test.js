const { deployContract, deployMockContract } = require('ethereum-waffle')
const { deploy1820 } = require('deploy-eip-1820')
const TicketHarness = require('../build/TicketHarness.json')
const PeriodicPrizePool = require('../build/PeriodicPrizePool.json')
const Timelock = require('../build/Timelock.json')
const IERC20 = require('../build/IERC20.json')
const PrizePoolModuleManager = require('../build/PrizePoolModuleManager.json')
const InterestTracker = require('../build/InterestTracker.json')
const ERC1820ImplementerMock = require('../build/ERC1820ImplementerMock.json')

const { deployMockModule } = require('../js/deployMockModule')
const Credit = require('../build/Credit.json')
const CompoundYieldService = require('../build/CompoundYieldService.json')
const {
  CREDIT_INTERFACE_HASH,
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

  let registry, prizePool, collateral, yieldService, manager, token, cToken, interestTracker, implementerMock

  let lastTxTimestamp

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()

    debug(`using wallet ${wallet._address}`)

    debug('creating manager and registry...')

    await deploy1820(wallet)

    manager = await deployMockContract(wallet, PrizePoolModuleManager.abi, overrides)
    token = await deployMockContract(wallet, IERC20.abi, overrides)
    yieldService = await deployMockContract(wallet, CompoundYieldService.abi, overrides)
    interestTracker = await deployMockContract(wallet, InterestTracker.abi, overrides)
    prizePool = await deployMockContract(wallet, PeriodicPrizePool.abi, overrides)
    timelock = await deployMockContract(wallet, Timelock.abi, overrides)

    await yieldService.mock.token.returns(token.address)
    await manager.mock.enableModuleInterface.withArgs(TICKET_INTERFACE_HASH).returns()
    await manager.mock.isModuleEnabled.withArgs(wallet._address).returns(true)

    await manager.mock.yieldService.returns(yieldService.address)
    await manager.mock.interestTracker.returns(interestTracker.address)
    await manager.mock.prizePool.returns(prizePool.address)
    await manager.mock.timelock.returns(timelock.address)

    ticket = await deployContract(wallet, TicketHarness, [], overrides)

    let tx = await ticket['initialize(address,address,string,string)'](
      manager.address,
      FORWARDER,
      'TICKET',
      'TICK'
    )
    let block = await buidler.ethers.provider.getBlock(tx.blockNumber)
    lastTxTimestamp = block.timestamp
  })

  describe('initialize()', () => {
    it('should set the params', async () => {
      expect(await ticket.name()).to.equal('TICKET')
      expect(await ticket.symbol()).to.equal('TICK')
      expect(await ticket.getTrustedForwarder()).to.equal(FORWARDER)
    })
  })

  describe('mintTickets()', () => {
    it('should create tickets', async () => {
      let amount = toWei('10')

      await token.mock.transferFrom.withArgs(wallet._address, ticket.address, amount).returns(true)
      await token.mock.allowance.returns(0)
      await token.mock.approve.returns(true)
      await yieldService.mock.supply.withArgs(amount).returns()
      await interestTracker.mock.supplyCollateral.withArgs(wallet._address, amount).returns()
      await prizePool.mock.mintedTickets.withArgs(toWei('10')).returns()

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
      await yieldService.mock.supply.withArgs(amount).returns()
      await interestTracker.mock.supplyCollateral.withArgs(wallet2._address, amount).returns()
      await prizePool.mock.mintedTickets.withArgs(toWei('10')).returns()
      
      await ticket.operatorMintTickets(wallet2._address, toWei('10'), [], [])

      expect(await ticket.balanceOf(wallet._address)).to.equal('0')
      expect(await ticket.balanceOf(wallet2._address)).to.equal(amount)
    })
  })

  describe('redeemTicketsInstantly()', () => {
    xit('should allow a user to pay to redeem their tickets', async () => {
    })
  })

  describe('redeemTicketsWithTimelock()', () => {
    it('should lock the users funds', async () => {
      await ticket.mint(wallet._address, toWei('10'))

      await timelock.mock.sweep.withArgs([wallet._address]).returns('0')

      // unlock timestamp is in future
      let unlockTimestamp = lastTxTimestamp + 100
      await prizePool.mock.calculateUnlockTimestamp.returns(unlockTimestamp)
      // current timelocked balance is zero
      await timelock.mock.balanceOf.withArgs(wallet._address).returns('0')

      // expect a mint on the timelock
      await timelock.mock.mintTo.withArgs(wallet._address, toWei('10'), unlockTimestamp).returns()

      // prize pool expects it
      await prizePool.mock.redeemedTickets.withArgs(toWei('10')).returns()

      await ticket.redeemTicketsWithTimelock(toWei('10'), [])

      expect(await ticket.balanceOf(wallet._address)).to.equal(toWei('0'))
    })

    it('should lock even if there is an existing timelock balance', async () => {
      await ticket.mint(wallet._address, toWei('10'))

      await timelock.mock.sweep.withArgs([wallet._address]).returns('0')

      // unlock timestamp is in future
      let unlockTimestamp = lastTxTimestamp + 100
      await prizePool.mock.calculateUnlockTimestamp.returns(unlockTimestamp)
      // current timelocked balance is non-zero, and still locked
      await timelock.mock.balanceOf.withArgs(wallet._address).returns(toWei('10'))
      await timelock.mock.balanceAvailableAt.withArgs(wallet._address).returns(unlockTimestamp)

      // prize pool expects it
      await prizePool.mock.redeemedTickets.withArgs(toWei('10')).returns()

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

      // prize pool expects it
      await prizePool.mock.redeemedTickets.withArgs(toWei('10')).returns()

      // expect a timelock sweep
      await timelock.mock.sweep.withArgs([wallet._address]).returns('0')

      // expect a mint on the timelock
      await timelock.mock.mintTo.withArgs(address, toWei('10'), unlockTimestamp).returns()

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

      // The timelocked tokens are swept
      await timelock.mock.sweep.withArgs([wallet._address]).returns('0')
      
      // prize pool expects it
      await prizePool.mock.redeemedTickets.withArgs(toWei('10')).returns()

      // the timelocked tokens are minted
      await timelock.mock.mintTo.withArgs(wallet._address, toWei('10'), lastTxTimestamp).returns()

      await ticket.redeemTicketsWithTimelock(toWei('10'), [])

      expect(await ticket.balanceOf(wallet._address)).to.equal(toWei('0'))
    })

    it('should not allow a user to redeem more than they have', async () => {
      await ticket.mint(wallet._address, toWei('10'))
      await expect(ticket.redeemTicketsWithTimelock(toWei('20'), [])).to.be.revertedWith('Insufficient balance')
    })
  })
});
