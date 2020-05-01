import { deployContract } from 'ethereum-waffle'
import MockInterestPool from '../build/MockInterestPool.json'
import MockPrizeStrategy from '../build/MockPrizeStrategy.json'
import PrizePool from '../build/PrizePool.json'
import ERC20Mintable from '../build/ERC20Mintable.json'
import ControlledToken from '../build/ControlledToken.json'
import { expect } from 'chai'
import { ethers, Contract } from 'ethers'
import { deploy1820 } from 'deploy-eip-1820'
import { increaseTime } from './helpers/increaseTime'

const buidler = require("@nomiclabs/buidler")

const toWei = ethers.utils.parseEther

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('PrizePool contract', () => {
  
  let prizePool: any
  let token: any
  let ticket: any
  let collateralToken: any
  let mockInterestPool: any
  let mockPrizeStrategy: any

  let wallet: any
  let allocator: any
  let otherWallet: any

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()

    await deploy1820(wallet)
    prizePool = await deployContract(wallet, PrizePool, [])
    token = await deployContract(wallet, ERC20Mintable, [])
    mockPrizeStrategy = await deployContract(wallet, MockPrizeStrategy, [])
    await mockPrizeStrategy.setPrizePool(prizePool.address)
    mockInterestPool = await deployContract(wallet, MockInterestPool, [])
    collateralToken = await deployContract(wallet, ControlledToken, [])
    await collateralToken.initialize(
      'Ticket',
      'TICK',
      mockInterestPool.address
    )
    ticket = await deployContract(wallet, ControlledToken, [])
    await ticket.initialize(
      'Ticket',
      'TICK',
      prizePool.address
    )
    await mockInterestPool.initialize(
      token.address,
      collateralToken.address
    )
    await prizePool.initialize(
      ticket.address,
      mockInterestPool.address,
      mockPrizeStrategy.address
    )
    await token.mint(wallet._address, ethers.utils.parseEther('100000'))
  })

  describe('initialize()', () => {
    it('should set all the vars', async () => {
      expect(await prizePool.ticket()).to.equal(ticket.address)
      expect(await prizePool.interestPool()).to.equal(mockInterestPool.address)
      expect(await prizePool.prizeStrategy()).to.equal(mockPrizeStrategy.address)
    })
  })

  describe('currentPrize()', () => {
    it('should return the available interest from the prize pool', async () => {
      await mockInterestPool.setAvailableInterest(toWei('100'))
      expect(await prizePool.currentPrize()).to.equal(toWei('100'))
    })
  })

  describe('mintTickets()', () => {
    it('should create tickets', async () => {
      await token.approve(prizePool.address, toWei('10'))
      await prizePool.mintTickets(toWei('10'))

      // underlying assets were moved to ticketpool
      expect(await token.balanceOf(prizePool.address)).to.equal(toWei('10'))
      
      // interest pool minted collateral tickets to the ticket pool
      expect(await collateralToken.balanceOf(prizePool.address)).to.equal(toWei('10'))

      // ticket pool minted tickets for the depositor
      expect(await ticket.balanceOf(wallet._address)).to.equal(toWei('10'))
    })
  })

  describe('redeemTicketsInstantly()', () => {
    it('should allow a user to pay to redeem their tickets', async () => {
      await mockPrizeStrategy.setExitFee(toWei('1'))

      await token.approve(prizePool.address, toWei('10'))
      await prizePool.mintTickets(toWei('10'))

      let userBalance = await token.balanceOf(wallet._address)

      await prizePool.redeemTicketsInstantly(toWei('10'))

      // tickets are burned
      expect(await ticket.totalSupply()).to.equal(toWei('0'))

      // collateral is destroyed
      expect(await collateralToken.balanceOf(prizePool.address)).to.equal(toWei('0'))

      // user receives tokens less fee
      expect((await token.balanceOf(wallet._address)).sub(userBalance)).to.equal(toWei('9'))
    })
  })

  describe('redeemTicketsWithTimelock()', () => {
    it('should lock the users funds', async () => {
      await token.approve(prizePool.address, toWei('10'))
      await prizePool.mintTickets(toWei('10'))
      const block = await buidler.ethers.provider.getBlock('latest')

      const unlockTimestamp = block.timestamp + 3
      await mockPrizeStrategy.setUnlockTimestamp(`${unlockTimestamp}`)

      await prizePool.redeemTicketsWithTimelock(toWei('10'))

      // Tickets are burned
      expect(await ticket.balanceOf(wallet._address)).to.equal('0')
      
      // Locked balance is recorded
      expect(await prizePool.lockedBalanceOf(wallet._address)).to.equal(toWei('10'))
      expect(await prizePool.lockedBalanceAvailableAt(wallet._address)).to.equal(unlockTimestamp)
    })

    it('should instantly redeem funds if unlockBlock is now or in the past', async () => {
      await token.approve(prizePool.address, toWei('10'))
      let tx = await prizePool.mintTickets(toWei('10'))
      let unlockBlock = tx.blockNumber + 2
      let userBalance = await token.balanceOf(wallet._address)
      await mockPrizeStrategy.setUnlockTimestamp(unlockBlock)
      tx = await prizePool.redeemTicketsWithTimelock(toWei('4'))
      // Tickets are transferred
      expect((await token.balanceOf(wallet._address)).sub(userBalance)).to.equal(toWei('4'))
      expect(await prizePool.lockedBalanceOf(wallet._address)).to.equal('0')
      expect(await prizePool.lockedBalanceAvailableAt(wallet._address)).to.equal('0')
    })

    it('should sweep old locked deposits', async () => {
      // create tickets
      await token.approve(prizePool.address, toWei('10'))
      await prizePool.mintTickets(toWei('10'))
      let block = await buidler.ethers.provider.getBlock('latest')
      let userBalance = await token.balanceOf(wallet._address)

      // set the unlock time far enough into the future so we can control it
      await mockPrizeStrategy.setUnlockTimestamp(block.timestamp + 60)
      // now redeem tickets
      await prizePool.redeemTicketsWithTimelock(toWei('4'))
      block = await buidler.ethers.provider.getBlock('latest')
      // tickets should be burned
      expect(await ticket.balanceOf(wallet._address)).to.equal(toWei('6'))
      
      // now let's progress time so that the previous funds are unlocked
      await increaseTime(60)

      let secondUnlockTimestamp = block.timestamp + 120
      await mockPrizeStrategy.setUnlockTimestamp(secondUnlockTimestamp)
      await prizePool.redeemTicketsWithTimelock(toWei('6'))
      // Remaining tickets are burned
      expect(await ticket.balanceOf(wallet._address)).to.equal(toWei('0'))

      // First set of redeemed tokens have been transferred
      expect((await token.balanceOf(wallet._address)).sub(userBalance)).to.equal(toWei('4'))

      // Locked balance is recorded
      expect(await prizePool.lockedBalanceOf(wallet._address)).to.equal(toWei('6'))
      expect(await prizePool.lockedBalanceAvailableAt(wallet._address)).to.equal(secondUnlockTimestamp)
    })
  })

  describe('sweepUnlockedFunds()', () => {
    it('should return any timelocked funds that are now open', async () => {
      // deposit
      await token.approve(prizePool.address, toWei('4'))
      await prizePool.mintTickets(toWei('4'))

      // redeem with timelock.  Will be ~ ten seconds in future
      let block = await buidler.ethers.provider.getBlock('latest')
      let userBalance = await token.balanceOf(wallet._address)
      let unlockTimestamp = block.timestamp + 10
      await mockPrizeStrategy.setUnlockTimestamp(unlockTimestamp)
      await prizePool.redeemTicketsWithTimelock(toWei('4'))

      expect(await prizePool.lockedBalanceAvailableAt(wallet._address)).to.equal(unlockTimestamp)

      // now progress time
      await increaseTime(10)

      await prizePool.sweepTimelockFunds([wallet._address])

      expect(await prizePool.lockedBalanceOf(wallet._address)).to.equal(toWei('0'))      

      expect((await token.balanceOf(wallet._address)).sub(userBalance)).to.equal(toWei('4'))
    })
  })

  describe('award()', () => {
    it('should allocate available interest as tickets to a user', async () => {
      await mockPrizeStrategy.award(wallet._address, toWei('10'))
      expect(await ticket.balanceOf(wallet._address)).to.equal(toWei('10'))
      expect(await collateralToken.balanceOf(prizePool.address)).to.equal(toWei('10'))
    })
  })
})
