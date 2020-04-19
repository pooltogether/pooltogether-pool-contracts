import { deployContract } from 'ethereum-waffle'
import MockTicketPool from '../build/MockTicketPool.json'
import MockInterestPool from '../build/MockInterestPool.json'
import ERC20Mintable from '../build/ERC20Mintable.json'
import SingleRandomWinnerPrizeStrategy from '../build/SingleRandomWinnerPrizeStrategy.json'
import Ticket from '../build/Ticket.json'
import ControlledToken from '../build/ControlledToken.json'
import { expect } from 'chai'
import { ethers, Contract } from 'ethers'
import { deploy1820 } from 'deploy-eip-1820'

import { printGas } from './helpers/printGas'

const buidler = require("@nomiclabs/buidler")

const toWei = ethers.utils.parseEther

describe('SingleRandomWinnerPrizeStrategy contract', () => {
  
  let ticket: Contract
  let mockInterestPool: Contract
  let mockTicketPool: Contract
  let prizeStrategy: Contract
  let collateralToken: Contract
  let token: Contract

  let wallet: any
  let allocator: any
  let otherWallet: any
  let prizePeriodStart: any

  let prizePeriod = 10

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()
    await deploy1820(wallet)
    ticket = await deployContract(wallet, Ticket, [])
    mockInterestPool = await deployContract(wallet, MockInterestPool, [])
    collateralToken = await deployContract(wallet, ControlledToken, [])
    await collateralToken.initialize(
      'Dai',
      'DAI',
      mockInterestPool.address
    )
    token = await deployContract(wallet, ERC20Mintable, [])
    await mockInterestPool.initialize(
      token.address,
      collateralToken.address
    )
    mockTicketPool = await deployContract(wallet, MockTicketPool, [])
    await ticket.initialize(
      "ticket",
      "tick",
      mockTicketPool.address
    )
    await mockTicketPool.initialize(
      ticket.address,
      mockInterestPool.address
    )

    await mockInterestPool.setSupplyRatePerBlock(toWei('0.01')) // 1% per block

    prizeStrategy = await deployContract(wallet, SingleRandomWinnerPrizeStrategy, [
      mockTicketPool.address,
      prizePeriod
    ])
    prizePeriodStart = await buidler.ethers.provider.getBlockNumber()
  })

  describe('remainingBlocksToPrize()', () => {
    it('should calculate the number of blocks', async () => {
      expect(await prizeStrategy.remainingBlocksToPrize()).to.equal('9')
    })
  })


  describe('prizePeriodEndBlock()', () => {
    it('should be correct', async () => {
      expect(await prizeStrategy.prizePeriodEndBlock()).to.equal(prizePeriodStart + 10)
    })    
  })

  describe('calculateExitFee(address, uint256 tickets)', () => {
    it('should calculate', async () => {
      let exitFee = await prizeStrategy.calculateExitFee(wallet._address, toWei('10'))
      
      // 9 remaining blocks, so total interest will be 9 * 0.01 = 0.09 so interest = 0.09 * 10 = 0.9
      expect(exitFee).to.equal(toWei('0.9'))
    })
  })

  describe('calculateUnlockBlock(address, uint256)', () => {
    it('should calculate the prize period end', async () => {
      expect(await prizeStrategy.calculateUnlockBlock(wallet._address, '0')).to.equal(prizePeriodStart + 10)
    })
  })

  describe('estimatePrize()', () => {
    it('should calculate the prize', async () => {
      await mockTicketPool.setCurrentPrize(toWei('1'))
      // 1 ether + 
      // bump collateral to 10
      await mockInterestPool.supplyCollateral(toWei('10'))

      // 2 blocks down, 7 left

      // total will be 7 blocks @ 0.01 = 0.9 + 1
      expect(await prizeStrategy.estimatePrize()).to.equal(toWei('1.7'))
    })
  })

  describe('estimateRemainingPrize()', () => {
    it('should estimate the remaining prize', async () => {
      // 1 ether + 
      // bump collateral to 10
      await mockInterestPool.supplyCollateral(toWei('10'))

      // 1 block down, 8 left

      // total will be 8 blocks @ 0.01 = 0.9 + 1
      expect(await prizeStrategy.estimatePrize()).to.equal(toWei('0.8'))
    })
  })

  describe('estimateAccruedInterest(uint256 principal, uint256 blocks)', () => {
    it('should estimate the remaining prize', async () => {
      expect(await prizeStrategy.estimateAccruedInterest(toWei('10'), '8')).to.equal(toWei('0.8'))
    })
  })

  describe('award()', () => {
    it('should draw a winner and allocate prize', async () => {
      // ensure the wallet can be selected
      await mockTicketPool.award(wallet._address, toWei('10'))

      // make up a prize
      await mockTicketPool.setCurrentPrize(toWei('1'))

      // 7 blocks left! Let's kill 'em
      for (var i = 0; i < 7; i++) {
        await mockTicketPool.setCurrentPrize(toWei('1'))
      }

      let tx = await prizeStrategy.award()

      expect(await ticket.balanceOf(wallet._address)).to.equal(toWei('11'))

      // new prize period end block
      expect(await prizeStrategy.prizePeriodEndBlock()).to.equal(tx.blockNumber + 10)
    })
  })

  describe('ticketToken()', () => {
    it('should return the ticket token', async () => {
      expect(await prizeStrategy.ticketToken()).to.equal(ticket.address)
    })
  })
})
