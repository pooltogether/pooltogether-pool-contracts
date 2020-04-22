import { deployContract } from 'ethereum-waffle'
import { waffle } from '@nomiclabs/buidler'
import InterestPool from '../build/InterestPool.json'
import ERC20Mintable from '../build/ERC20Mintable.json'
import CTokenMock from '../build/CTokenMock.json'
import ControlledToken from '../build/ControlledToken.json'
import { expect } from 'chai'
import { ethers, Contract } from 'ethers'
import { deploy1820 } from 'deploy-eip-1820'
const buidler = require("@nomiclabs/buidler")

const toWei = ethers.utils.parseEther

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('InterestPool contract', () => {
  
  let interestPool: Contract
  let token: Contract
  let collateralToken: Contract
  let cToken: Contract

  let wallet: any
  let allocator: any
  let otherWallet: any

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()

    await deploy1820(wallet)
    interestPool = await deployContract(wallet, InterestPool, [])
    token = await deployContract(wallet, ERC20Mintable, [])
    cToken = await deployContract(wallet, CTokenMock, [])
    await cToken.initialize(token.address, ethers.utils.parseEther('0.01'))
    collateralToken = await deployContract(wallet, ControlledToken, [])
    await collateralToken.initialize(
      'Ticket',
      'TICK',
      interestPool.address
    )
    await interestPool.initialize(
      cToken.address,
      collateralToken.address,
      allocator._address
    )
    await token.mint(wallet._address, ethers.utils.parseEther('100000'))
  })

  describe('initialize()', () => {
    it('should set all the vars', async () => {
      expect(await interestPool.collateralToken()).to.equal(collateralToken.address)
      expect(await interestPool.cToken()).to.equal(cToken.address)
    })
  })

  describe('supplyCollateral()', () => {
    it('should give the first depositer tokens at the initial exchange rate', async function () {
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.supplyCollateral(toWei('1'))

      expect(await collateralToken.balanceOf(wallet._address)).to.equal(toWei('1'))
      expect(await collateralToken.totalSupply()).to.equal(toWei('1'))
    })
  })

  describe('redeemCollateral()', () => {
    it('should allow a user to withdraw their collateral', async function () {
      let startBalance = await token.balanceOf(wallet._address)
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.supplyCollateral(toWei('1'))

      expect(await collateralToken.balanceOf(wallet._address)).to.equal(toWei('1'))
      expect(startBalance.sub(await token.balanceOf(wallet._address))).to.equal(toWei('1'))

      await interestPool.redeemCollateral(toWei('1'))

      expect(await collateralToken.balanceOf(wallet._address)).to.equal('0')
      expect(await token.balanceOf(wallet._address)).to.equal(startBalance)
    })
  })

  describe('availableInterest()', () => {
    it('should return zero when no interest has accrued', async () => {
      expect((await interestPool.availableInterest()).toString()).to.equal(toWei('0'))
    })

    it('should return the amount of interest available', async function () {
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.supplyCollateral(toWei('1'))
      await cToken.accrueCustom(toWei('2'))
      expect(await interestPool.availableInterest()).to.equal(toWei('2'))
    })
  })

  describe('allocateInterest()', () => {
    it('should allow the allocator to give people interest', async () => {
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.supplyCollateral(toWei('1'))
      await cToken.accrueCustom(toWei('2'))
      expect((await interestPool.availableInterest()).toString()).to.equal(toWei('2'))
      await interestPool.connect(allocator).allocateInterest(wallet._address, toWei('2'))
      expect(await interestPool.availableInterest()).to.equal('0')
      expect(await collateralToken.balanceOf(wallet._address)).to.equal(toWei('3'))
    })

    it('cannot allocate more interest than available', async () => {
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.supplyCollateral(toWei('1'))
      await cToken.accrueCustom(toWei('1'))
      await expect(interestPool.connect(allocator).allocateInterest(wallet._address, toWei('2'))).to.be.revertedWith('exceed-interest')
    })

    it('should only allow the allocator to allocate', async () => {
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.supplyCollateral(toWei('1'))
      await cToken.accrueCustom(toWei('1'))
      await expect(interestPool.allocateInterest(wallet._address, toWei('1'))).to.be.revertedWith('only the allocator')
    })
  })

  describe('accountedBalance()', () => {
    it('should return the balance that has been allocated or supplied', async () => {
      await token.approve(interestPool.address, toWei('2'))
      await interestPool.supplyCollateral(toWei('2'))
      expect(await interestPool.accountedBalance()).to.equal(toWei('2'))
    })
  })

  describe('exchangeRateCurrent()', () => {
    it('should return 1e18 when no tokens or accrual', async () => {
      expect(await interestPool.exchangeRateCurrent()).to.equal(toWei('1'))
    })

    it('should return the correct exchange rate', async () => {
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.supplyCollateral(toWei('1'))
      await cToken.accrueCustom(toWei('0.5'))

      expect(await interestPool.exchangeRateCurrent()).to.equal(toWei('1.5'))
    })
  })

  describe('valueOfCTokens()', () => {
    it('should calculate correctly', async () => {
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.supplyCollateral(toWei('1'))
      await cToken.accrueCustom(toWei('0.5'))
      
      expect(await interestPool.valueOfCTokens(toWei('1'))).to.equal(toWei('1.5'))
      expect(await interestPool.cTokenValueOf(toWei('1.5'))).to.equal(toWei('1'))
    })
  })
})
