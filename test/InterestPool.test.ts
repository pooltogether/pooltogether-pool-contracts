import { deployContract, link } from 'ethereum-waffle'
import { waffle } from '@nomiclabs/buidler'
import GovernanceFee from '../build/GovernanceFee.json'
import InterestPool from '../build/InterestPool.json'
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
describe('InterestPool contract', () => {
  
  let interestPool: Contract
  let token: Contract
  let ticketToken: Contract
  let sponsorshipToken: Contract
  let prizeStrategy: Contract
  let governanceFee: Contract
  let cToken: Contract

  beforeEach(async () => {
    await deploy1820(wallet)
    governanceFee = await deployContract(wallet, GovernanceFee, [])
    interestPool = await deployContract(wallet, InterestPool, [])
    token = await deployContract(wallet, ERC20Mintable, [])
    cToken = await deployContract(wallet, CTokenMock, [])
    await cToken.initialize(token.address, ethers.utils.parseEther('0.01'))
    ticketToken = await deployContract(wallet, ControlledToken, [
      'Ticket',
      'TICK',
      interestPool.address
    ])
    sponsorshipToken = await deployContract(wallet, ControlledToken, [
      'Sponsorship',
      'SPON',
      interestPool.address
    ])
    const sumTreeFactory = await deployContract(wallet, SortitionSumTreeFactory)
    MockPrizeStrategy.bytecode = linkLibraries(MockPrizeStrategy.bytecode, [
      { name: 'SortitionSumTreeFactory.sol', address: sumTreeFactory.address }
    ])
    prizeStrategy = await deployContract(wallet, MockPrizeStrategy, [
      interestPool.address
    ])
    await interestPool.initialize(
      governanceFee.address,
      cToken.address,
      ticketToken.address,
      sponsorshipToken.address,
      prizeStrategy.address
    )

    await token.mint(wallet.address, ethers.utils.parseEther('100000'))
  })

  describe('initialize()', () => {
    it('should set all the vars', async () => {
      expect(await interestPool.prizeStrategy()).to.equal(prizeStrategy.address)
      expect(await interestPool.factory()).to.equal(governanceFee.address)
      expect(await interestPool.vouchers()).to.equal(ticketToken.address)
      expect(await interestPool.cToken()).to.equal(cToken.address)
    })
  })

  describe('mintVouchers()', () => {
    it('should give the first depositer tokens at the initial exchange rate', async function () {
      await token.approve(interestPool.address, toWei('2'))
      await interestPool.mintVouchers(toWei('1'))

      // cToken should hold the tokens
      expect(await token.balanceOf(cToken.address)).to.equal(toWei('1'))
      // initial exchange rate is one
      expect(await cToken.balanceOf(interestPool.address)).to.equal(toWei('1'))
      // ticket holder should have their share
      expect(await ticketToken.balanceOf(wallet.address)).to.equal(toWei('1'))
    })
  })

  describe('exchangeRateCurrent()', () => {
    it('should return 1e18 when no tokens or accrual', async () => {
      expect(await interestPool.exchangeRateCurrent()).to.equal(toWei('1'))
    })

    it('should return the correct exchange rate', async () => {
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.mintVouchers(toWei('1'))
      await cToken.accrueCustom(toWei('0.5'))

      expect(await interestPool.exchangeRateCurrent()).to.equal(toWei('1.5'))
    })
  })

  describe('valueOfCTokens()', () => {
    it('should calculate correctly', async () => {
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.mintVouchers(toWei('1'))
      await cToken.accrueCustom(toWei('0.5'))
      
      expect(await interestPool.valueOfCTokens(toWei('1'))).to.equal(toWei('1.5'))
      expect(await interestPool.cTokenValueOf(toWei('1.5'))).to.equal(toWei('1'))
    })
  })

  describe('currentInterest()', () => {
    it('should return zero when no interest has accrued', async () => {
      expect((await interestPool.currentInterest(toWei('1'))).toString()).to.equal(toWei('0'))
    })

    it('should return the correct missed interest', async () => {
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.mintVouchers(toWei('1'))
      await cToken.accrueCustom(toWei('0.5'))

      expect(await cToken.balanceOfUnderlying(interestPool.address)).to.equal(toWei('1.5'))
      expect(await interestPool.exchangeRateCurrent()).to.equal(toWei('1.5'))
      expect(await ticketToken.totalSupply()).to.equal(toWei('1'))
      expect(await interestPool.voucherCTokens()).to.equal(toWei('1'))

      // interest is 50% on the single dai.  2 Dai will need 1 dai
      expect((await interestPool.currentInterest(toWei('2'))).toString()).to.equal(toWei('1'))
    })
  })
})
