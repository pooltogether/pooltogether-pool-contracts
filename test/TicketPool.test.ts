import { deployContract } from 'ethereum-waffle'
import MockInterestPool from '../build/MockInterestPool.json'
import MockPrizeStrategy from '../build/MockPrizeStrategy.json'
import TicketPool from '../build/TicketPool.json'
import ERC20Mintable from '../build/ERC20Mintable.json'
import ControlledToken from '../build/ControlledToken.json'
import { expect } from 'chai'
import { ethers, Contract } from 'ethers'
import { deploy1820 } from 'deploy-eip-1820'

import { printGas } from './helpers/printGas'

const buidler = require("@nomiclabs/buidler")

const toWei = ethers.utils.parseEther

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('TicketPool contract', () => {
  
  let ticketPool: Contract
  let token: Contract
  let ticketToken: Contract
  let collateralToken: Contract
  let mockInterestPool: Contract
  let mockPrizeStrategy: Contract

  let wallet: any
  let allocator: any
  let otherWallet: any

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()

    await deploy1820(wallet)
    ticketPool = await deployContract(wallet, TicketPool, [])
    token = await deployContract(wallet, ERC20Mintable, [])
    mockPrizeStrategy = await deployContract(wallet, MockPrizeStrategy, [])
    await mockPrizeStrategy.setTicketPool(ticketPool.address)
    mockInterestPool = await deployContract(wallet, MockInterestPool, [])
    collateralToken = await deployContract(wallet, ControlledToken, [])
    await collateralToken.initialize(
      'Ticket',
      'TICK',
      mockInterestPool.address
    )
    ticketToken = await deployContract(wallet, ControlledToken, [])
    await ticketToken.initialize(
      'Ticket',
      'TICK',
      ticketPool.address
    )
    await mockInterestPool.initialize(
      token.address,
      collateralToken.address
    )
    await ticketPool.initialize(
      ticketToken.address,
      mockInterestPool.address,
      mockPrizeStrategy.address
    )
    await token.mint(wallet._address, ethers.utils.parseEther('100000'))
  })

  describe('initialize()', () => {
    it('should set all the vars', async () => {
      expect(await ticketPool.ticketToken()).to.equal(ticketToken.address)
      expect(await ticketPool.interestPool()).to.equal(mockInterestPool.address)
      expect(await ticketPool.prizeStrategy()).to.equal(mockPrizeStrategy.address)
    })
  })

  describe('currentPrize()', () => {
    it('should return the available interest from the prize pool', async () => {
      await mockInterestPool.setAvailableInterest(toWei('100'))
      expect(await ticketPool.currentPrize()).to.equal(toWei('100'))
    })
  })

  describe('mintTickets()', () => {
    it('should create tickets', async () => {
      await token.approve(ticketPool.address, toWei('10'))
      await ticketPool.mintTickets(toWei('10'))

      // underlying assets were moved to ticketpool
      expect(await token.balanceOf(ticketPool.address)).to.equal(toWei('10'))
      
      // interest pool minted collateral tickets to the ticket pool
      expect(await collateralToken.balanceOf(ticketPool.address)).to.equal(toWei('10'))

      // ticket pool minted tickets for the depositor
      expect(await ticketToken.balanceOf(wallet._address)).to.equal(toWei('10'))
    })
  })

  describe('redeemTicketsInstantly()', () => {
    it('should allow a user to pay to redeem their tickets', async () => {
      await mockPrizeStrategy.setExitFee(toWei('1'))

      await token.approve(ticketPool.address, toWei('10'))
      await ticketPool.mintTickets(toWei('10'))

      let userBalance = await token.balanceOf(wallet._address)

      await printGas(ticketPool.redeemTicketsInstantly(toWei('10')), "TicketPool#redeemTicketsInstantly")

      // tickets are burned
      expect(await ticketToken.totalSupply()).to.equal(toWei('0'))

      // collateral is destroyed
      expect(await collateralToken.balanceOf(ticketPool.address)).to.equal(toWei('0'))

      // user receives tokens less fee
      expect((await token.balanceOf(wallet._address)).sub(userBalance)).to.equal(toWei('9'))
    })
  })

  describe('redeemTicketsWithTimelock()', () => {
    it('should lock the users funds', async () => {
      await token.approve(ticketPool.address, toWei('10'))
      const tx = await ticketPool.mintTickets(toWei('10'))

      const unlockBlock = tx.blockNumber + 3
      await mockPrizeStrategy.setUnlockBlock(unlockBlock)

      await ticketPool.redeemTicketsWithTimelock(toWei('10'))

      // Tickets are burned
      expect(await ticketToken.balanceOf(wallet._address)).to.equal('0')
      
      // Locked balance is recorded
      expect(await ticketPool.lockedBalanceOf(wallet._address)).to.equal(toWei('10'))
      expect(await ticketPool.lockedBalanceAvailableAt(wallet._address)).to.equal(unlockBlock)
    })

    it('should instantly redeem funds if unlockBlock is now or in the past', async () => {
      await token.approve(ticketPool.address, toWei('10'))
      let tx = await ticketPool.mintTickets(toWei('10'))
      let unlockBlock = tx.blockNumber + 2
      let userBalance = await token.balanceOf(wallet._address)
      await mockPrizeStrategy.setUnlockBlock(unlockBlock)
      tx = await ticketPool.redeemTicketsWithTimelock(toWei('4'))
      // Tickets are transferred
      expect((await token.balanceOf(wallet._address)).sub(userBalance)).to.equal(toWei('4'))
      expect(await ticketPool.lockedBalanceOf(wallet._address)).to.equal('0')
      expect(await ticketPool.lockedBalanceAvailableAt(wallet._address)).to.equal('0')
    })

    it('should sweep old locked deposits', async () => {
      await token.approve(ticketPool.address, toWei('10'))
      let tx = await ticketPool.mintTickets(toWei('10'))

      let userBalance = await token.balanceOf(wallet._address)

      await mockPrizeStrategy.setUnlockBlock(tx.blockNumber + 3)

      tx = await ticketPool.redeemTicketsWithTimelock(toWei('4'))
      
      // Tickets are burned
      expect(await ticketToken.balanceOf(wallet._address)).to.equal(toWei('6'))

      let secondUnlockBlock = tx.blockNumber + 3
      await mockPrizeStrategy.setUnlockBlock(secondUnlockBlock)

      await ticketPool.redeemTicketsWithTimelock(toWei('6'))

      // Tickets are transferred
      expect((await token.balanceOf(wallet._address)).sub(userBalance)).to.equal(toWei('4'))

      // Remaining tickets are burned
      expect(await ticketToken.balanceOf(wallet._address)).to.equal(toWei('0'))

      // Locked balance is recorded
      expect(await ticketPool.lockedBalanceOf(wallet._address)).to.equal(toWei('6'))
      expect(await ticketPool.lockedBalanceAvailableAt(wallet._address)).to.equal(secondUnlockBlock)
    })
  })

  describe('sweepUnlockedFunds()', () => {
    it('should return any timelocked funds that are now open', async () => {
      await token.approve(ticketPool.address, toWei('4'))
      let tx = await printGas(ticketPool.mintTickets(toWei('4')), 'TicketPool#mintTickets')
      let userBalance = await token.balanceOf(wallet._address)
      await mockPrizeStrategy.setUnlockBlock(tx.blockNumber + 3)
      tx = await printGas(ticketPool.redeemTicketsWithTimelock(toWei('4')), 'TicketPool#redeemTicketsWithTimelock')
      // will be available next block
      expect(await ticketPool.lockedBalanceAvailableAt(wallet._address)).to.equal(tx.blockNumber + 1)

      await ticketPool.sweepTimelockFunds([wallet._address])

      expect(await ticketPool.lockedBalanceOf(wallet._address)).to.equal(toWei('0'))      

      expect((await token.balanceOf(wallet._address)).sub(userBalance)).to.equal(toWei('4'))
    })
  })

  describe('award()', () => {
    it('should allocate available interest as tickets to a user', async () => {
      await mockPrizeStrategy.award(wallet._address, toWei('10'))
      expect(await ticketToken.balanceOf(wallet._address)).to.equal(toWei('10'))
      expect(await collateralToken.balanceOf(ticketPool.address)).to.equal(toWei('10'))
    })
  })
})
