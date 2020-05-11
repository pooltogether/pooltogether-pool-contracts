import { deployContract } from 'ethereum-waffle'
import CompoundYieldService from '../build/CompoundYieldService.json'
import ERC20Mintable from '../build/ERC20Mintable.json'
import CTokenMock from '../build/CTokenMock.json'
import ControlledToken from '../build/ControlledToken.json'
import { expect } from 'chai'
import { ethers } from './helpers/ethers'
import { balanceOf } from './helpers/balanceOf'
import buidler from './helpers/buidler'

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:CompoundYieldService.test')

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('YieldService contract', () => {
  
  let yieldService: any
  let token: any
  let cToken: any

  let wallet: any
  let allocator: any
  let otherWallet: any

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()

    yieldService = await deployContract(wallet, CompoundYieldService, [])
    token = await deployContract(wallet, ERC20Mintable, [])
    cToken = await deployContract(wallet, CTokenMock, [
      token.address, ethers.utils.parseEther('0.01')
    ])
    await yieldService.initialize(
      cToken.address
    )
    await token.mint(wallet._address, ethers.utils.parseEther('100000'))
  })

  describe('initialize()', () => {
    it('should set all the vars', async () => {
      expect(await yieldService.cToken()).to.equal(cToken.address)
    })
  })

  describe('supply()', () => {
    it('should give the first depositer tokens at the initial exchange rate', async function () {
      await token.approve(yieldService.address, toWei('1'))
      await yieldService.supply(toWei('1'))

      expect(await balanceOf(cToken, yieldService.address)).to.equal(toWei('1'))
      expect(await cToken.totalSupply()).to.equal(toWei('1'))
    })
  })

  describe('redeemUnderlying()', () => {
    it('should allow a user to withdraw their principal', async function () {
      let startBalance = await token.balanceOf(wallet._address)
      await token.approve(yieldService.address, toWei('1'))
      await yieldService.supply(toWei('1'))

      await yieldService.redeem(toWei('1'))

      expect(await cToken.balanceOf(wallet._address)).to.equal('0')
      expect(await token.balanceOf(wallet._address)).to.equal(startBalance)
    })
  })

  describe('balanceOf()', () => {
    it('should return zero when no interest has accrued', async () => {
      expect((await balanceOf(yieldService, wallet._address)).toString()).to.equal(toWei('0'))
    })

    it('should return the amount of interest available', async function () {
      await token.approve(yieldService.address, toWei('1'))
      await yieldService.supply(toWei('1'))
      
      expect(await cToken.balanceOf(yieldService.address)).to.equal(toWei('1'))
      expect(await yieldService.cTokenBalanceOf(wallet._address)).to.equal(toWei('1'))

      await cToken.accrueCustom(toWei('2'))

      debug('checking cToken balance...')
      // console.log('check balance of interest pool')
      expect(await cToken.balanceOf(yieldService.address)).to.equal(toWei('1'))

      debug('checking yieldService balance...')
      // console.log('check balance of wallet')
      expect(await balanceOf(yieldService, wallet._address)).to.equal(toWei('3'))
    })
  })
})
