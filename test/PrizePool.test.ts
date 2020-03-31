import { deployContract, link } from 'ethereum-waffle'
import { waffle } from '@nomiclabs/buidler'
import PrizePoolFactory from '../build/PrizePoolFactory.json'
import PrizePool from '../build/PrizePool.json'
import ERC20Mintable from '../build/ERC20Mintable.json'
import CTokenMock from '../build/CTokenMock.json'
import ControlledToken from '../build/ControlledToken.json'
import SortitionSumTreeFactory from '../build/SortitionSumTreeFactory.json'
import MockPrizeStrategy from '../build/MockPrizeStrategy.json'
import { expect } from 'chai'
import { ethers, Contract } from 'ethers'
import { deploy1820 } from 'deploy-eip-1820'
import { linkLibraries } from './helpers/link'

const provider = waffle.provider
const [wallet, otherWallet] = provider.getWallets()

const toWei = ethers.utils.parseEther

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('PrizePool contract', () => {
  
  let prizePool: Contract
  let token: Contract
  let ticketToken: Contract
  let sponsorshipToken: Contract
  let prizeStrategy: Contract
  let prizePoolFactory: Contract
  let cToken: Contract

  beforeEach(async () => {
    await deploy1820(wallet)
    prizePoolFactory = await deployContract(wallet, PrizePoolFactory, [])
    prizePool = await deployContract(wallet, PrizePool, [])
    token = await deployContract(wallet, ERC20Mintable, [])
    cToken = await deployContract(wallet, CTokenMock, [])
    await cToken.initialize(token.address, ethers.utils.parseEther('0.01'))
    ticketToken = await deployContract(wallet, ControlledToken, [
      prizePool.address,
      'Ticket',
      'TICK',
      []
    ])
    sponsorshipToken = await deployContract(wallet, ControlledToken, [
      prizePool.address,
      'Sponsorship',
      'SPON',
      []
    ])
    const sumTreeFactory = await deployContract(wallet, SortitionSumTreeFactory)
    MockPrizeStrategy.bytecode = linkLibraries(MockPrizeStrategy.bytecode, [
      { name: 'SortitionSumTreeFactory.sol', address: sumTreeFactory.address }
    ])
    prizeStrategy = await deployContract(wallet, MockPrizeStrategy, [
      prizePool.address
    ])
    await prizePool.initialize(
      prizeStrategy.address,
      prizePoolFactory.address,
      cToken.address,
      ticketToken.address,
      sponsorshipToken.address,
      ethers.utils.parseEther('0.1'),
      '0'
    )

    await token.mint(wallet.address, ethers.utils.parseEther('100000'))
  })

  describe('initialize()', () => {
    it('should set all the vars', async () => {
      expect(await prizePool.prizeStrategy()).to.equal(prizeStrategy.address)
      expect(await prizePool.factory()).to.equal(prizePoolFactory.address)
      expect(await prizePool.ticketToken()).to.equal(ticketToken.address)
      expect(await prizePool.cToken()).to.equal(cToken.address)

      expect(await prizePool.feeFraction()).to.equal('0')
      expect(await prizePool.reserveRateMantissa()).to.equal(toWei('0.1'))
      expect(await prizePool.lastPrizeExchangeRate()).to.equal(toWei('1'))
    })
  })

  describe('deposit()', () => {
    it('should give the first depositer tokens at the initial exchange rate', async function () {
      await token.approve(prizePool.address, toWei('1'))
      await prizePool.deposit(toWei('1'))

      // cToken should hold the tokens
      expect(await token.balanceOf(cToken.address)).to.equal(toWei('1'))
      // initial exchange rate is one
      expect(await cToken.balanceOf(prizePool.address)).to.equal(toWei('1'))
      // ticket holder should have their share
      expect(await ticketToken.balanceOf(wallet.address)).to.equal(toWei('1'))
      // ensure prize strategy was notified
      expect(await prizeStrategy.lastAfterBalanceChanged(wallet.address)).to.equal(toWei('1'))
      // ensure that missing interest was zero
      expect(await prizePool.balanceOfMissingInterest(wallet.address)).to.equal('0')
    })
  })

  describe('exchangeRateCurrent()', () => {
    it('should return 1e18 when no tokens or accrual', async () => {
      expect(await prizePool.exchangeRateCurrent()).to.equal(toWei('1'))
    })

    it('should return the correct exchange rate', async () => {
      await token.approve(prizePool.address, toWei('1'))
      await prizePool.deposit(toWei('1'))
      await cToken.accrueCustom(toWei('0.5'))

      expect(await prizePool.exchangeRateCurrent()).to.equal(toWei('1.5'))
    })
  })

  describe('calculateCurrentPrizeInterest()', () => {
    it('should return zero when no interest has accrued', async () => {
      expect((await prizePool.calculateCurrentPrizeInterest(toWei('1'))).toString()).to.equal(toWei('0'))
    })

    it('should return the correct missed interest', async () => {
      await token.approve(prizePool.address, toWei('1'))
      await prizePool.deposit(toWei('1'))
      await cToken.accrueCustom(toWei('0.5'))

      expect(await prizePool.exchangeRateCurrent()).to.equal(toWei('1.5'))

      // interest is 50%.  2 Dai less the 10% reserve rate is 1.8.  50% of 1.8 is 0.9
      expect((await prizePool.calculateCurrentPrizeInterest(toWei('2'))).toString()).to.equal(toWei('0.9'))
    })
  })
})
