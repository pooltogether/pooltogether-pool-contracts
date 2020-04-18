import { deployContract } from 'ethereum-waffle'
import MockInterestPool from '../build/MockInterestPool.json'
import MockPrizeStrategy from '../build/MockPrizeStrategy.json'
import TicketPool from '../build/TicketPool.json'
import ERC20Mintable from '../build/ERC20Mintable.json'
import CTokenMock from '../build/CTokenMock.json'
import ControlledToken from '../build/ControlledToken.json'
import { expect } from 'chai'
import { ethers, Contract } from 'ethers'
import { deploy1820 } from 'deploy-eip-1820'
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
    mockInterestPool = await deployContract(wallet, MockInterestPool, [])
    collateralToken = await deployContract(wallet, ControlledToken, [
      'Ticket',
      'TICK',
      mockInterestPool.address
    ])
    ticketToken = await deployContract(wallet, ControlledToken, [
      'Ticket',
      'TICK',
      ticketPool.address
    ])
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
    xit('should set all the vars', async () => {
      expect(await ticketPool.ticketToken()).to.equal(ticketToken.address)
      expect(await ticketPool.interestPool()).to.equal(mockInterestPool.address)
      expect(await ticketPool.prizeStrategy()).to.equal(mockPrizeStrategy.address)
    })
  })

  describe('currentPrize()', () => {
    xit('should return the available interest from the prize pool', async () => {
      await mockInterestPool.setAvailableInterest(toWei('100'))
      expect(await ticketPool.currentPrize()).to.equal(toWei('100'))
    })
  })

  describe('mintTickets()', () => {
    xit('should create tickets', async () => {
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

      await ticketPool.redeemTicketsInstantly(toWei('10'))

      // tickets are gone
      expect(await ticketToken.totalSupply()).to.equal(toWei('0'))

      // collateral is destroyed
      expect(await collateralToken.balanceOf(ticketPool.address)).to.equal(toWei('0'))

      // user receives tokens less fee
      expect((await token.balanceOf(wallet._address)).sub(userBalance)).to.equal(toWei('9'))
    })
  })

  describe('redeemTicketsWithTimelock()', () => {

  })

  describe('sweepUnlockedFunds()', () => {

  })

  describe('award()', () => {

  })
})
