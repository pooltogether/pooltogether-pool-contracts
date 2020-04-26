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

import { increaseTime } from './helpers/increaseTime'
import { printGas } from './helpers/printGas'
import { BaseProvider, JsonRpcProvider } from 'ethers/providers'

import buidler from "@nomiclabs/buidler"

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

  let provider: JsonRpcProvider

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

    provider = buidler.ethers.provider

    await mockInterestPool.setSupplyRatePerBlock(toWei('0.01')) // 1% per block

    prizeStrategy = await deployContract(wallet, SingleRandomWinnerPrizeStrategy, [])
    await prizeStrategy.initialize(
      mockTicketPool.address,
      prizePeriod
    )
    let block = await buidler.ethers.provider.getBlock('latest')
    prizePeriodStart = block.timestamp
  })

  describe('multiplyByRemainingTimeFraction()', () => {
    it('should calculate as a fraction of the time remaining', async () => {
      // 9 seconds left
      expect(await prizeStrategy.multiplyByRemainingTimeFraction(toWei('1'))).to.equal(toWei('0.9'))

      // increment 4
      await increaseTime(4)
      
      // now should be half
      expect(await prizeStrategy.multiplyByRemainingTimeFraction(toWei('1'))).to.equal(toWei('0.5'))
    })
  })

  describe('remainingSecondsToPrize()', () => {
    it('should calculate the number of blocks', async () => {
      expect(await prizeStrategy.remainingSecondsToPrize()).to.equal('9')

      // increment 4
      await increaseTime(4)

      expect(await prizeStrategy.remainingSecondsToPrize()).to.equal('5')
    })
  })

  describe('prizePeriodEndAt()', () => {
    it('should be correct', async () => {
      expect(await prizeStrategy.prizePeriodEndAt()).to.equal(prizePeriodStart + 10)
    })    
  })

  describe('calculateExitFee(address, uint256 tickets)', () => {
    it('should calculate', async () => {
      // ensure there is interest
      await mockInterestPool.setAvailableInterest(toWei('1'))
      // ensure the wallet is a user
      await mockTicketPool.award(wallet._address, toWei('10'))
      
      await increaseTime(10)

      // award the prize.  will be 1 new ticket
      await prizeStrategy.award()

      // 9 seconds left until next prize
      expect(await prizeStrategy.remainingSecondsToPrize()).to.equal('9')

      expect(await ticket.totalSupply()).to.equal(toWei('11'))

      // increase time by half a period
      // await provider.send('evm_increaseTime', [ 0 ])

      // now post-prize we want to check the fee
      let exitFee = await prizeStrategy.calculateExitFee(wallet._address, toWei('11'))
      
      // last prize was 1, and we have 9 seconds left out of 10. 9/10 of 1 is 0.9
      expect(exitFee).to.equal(toWei('0.9'))
    })
  })

  describe('calculateUnlockTimestamp(address, uint256)', () => {
    it('should calculate the prize period end', async () => {
      expect(await prizeStrategy.calculateUnlockTimestamp(wallet._address, '0')).to.equal(prizePeriodStart + 10)
    })
  })

  describe('estimatePrize()', () => {
    it('should calculate the prize', async () => {
      await mockInterestPool.setAvailableInterest(toWei('1'))
      await mockInterestPool.supply(toWei('10'))
      // should be current prize + estimated remaining
      expect(await prizeStrategy.estimatePrize('1')).to.equal('1000000000000000045')
    })
  })

  describe('estimateRemainingPrize()', () => {
    it('should estimate the remaining prize', async () => {
      expect(await prizeStrategy.estimateRemainingPrize()).to.equal('45')
    })
  })

  describe('estimateRemainingPrizeWithBlockTime(uint256)', () => { 
    it('should estimate the prize given the seconds per block', async () => {
      expect(await prizeStrategy.estimateRemainingPrizeWithBlockTime(toWei('10'))).to.equal('45')
    })
  })

  describe('estimateRemainingBlocksToPrize(uint256)', () => {
    it('should estimate the number of remaining blocks', async () => {
      // assuming here there are 9 seconds remaining to prize
      expect(await prizeStrategy.remainingSecondsToPrize()).to.equal('9')

      // 2 seconds per block means there are 9 / 2 ~ 4 blocks left
      expect(await prizeStrategy.estimateRemainingBlocksToPrize(toWei('2'))).to.equal(('4'))

      // 9 seconds per block means 9 / 9 = 1
      expect(await prizeStrategy.estimateRemainingBlocksToPrize(toWei('9'))).to.equal(('1'))

      // 10 seconds per block means 9 / 10 = 0
      expect(await prizeStrategy.estimateRemainingBlocksToPrize(toWei('10'))).to.equal(('0'))
    })
  })

  describe('award()', () => {
    it('should not be called before the prize period is over', async () => {
      await expect(prizeStrategy.award()).to.be.revertedWith('prize period not over')
    })

    it('should draw a winner and allocate prize', async () => {
      // ensure the wallet can be selected
      await mockTicketPool.award(wallet._address, toWei('10'))

      await mockInterestPool.setAvailableInterest(toWei('1'))

      await increaseTime(9)
      await prizeStrategy.award()
      let block = await buidler.ethers.provider.getBlock('latest')

      expect(await ticket.balanceOf(wallet._address)).to.equal(toWei('11'))

      // new prize period end block
      expect(await prizeStrategy.prizePeriodEndAt()).to.equal(block.timestamp + 10)
    })
  })

  describe('ticket()', () => {
    it('should return the ticket token', async () => {
      expect(await prizeStrategy.ticket()).to.equal(ticket.address)
    })
  })
})
