import { deployContract } from 'ethereum-waffle'
import CompoundInterestPool from '../build/CompoundInterestPool.json'
import ERC20Mintable from '../build/ERC20Mintable.json'
import CTokenMock from '../build/CTokenMock.json'
import ControlledToken from '../build/ControlledToken.json'
import { expect } from 'chai'
import { ethers } from './helpers/ethers'
import buidler from './helpers/buidler'

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:CompoundInterestPool.test')

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('InterestPool contract', () => {
  
  let interestPool: any
  let token: any
  let cToken: any

  let wallet: any
  let allocator: any
  let otherWallet: any

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()

    interestPool = await deployContract(wallet, CompoundInterestPool, [])
    token = await deployContract(wallet, ERC20Mintable, [])
    cToken = await deployContract(wallet, CTokenMock, [
      token.address, ethers.utils.parseEther('0.01')
    ])
    await interestPool.initialize(
      cToken.address
    )
    await token.mint(wallet._address, ethers.utils.parseEther('100000'))
  })

  describe('initialize()', () => {
    it('should set all the vars', async () => {
      expect(await interestPool.cToken()).to.equal(cToken.address)
    })
  })

  describe('supply()', () => {
    it('should give the first depositer tokens at the initial exchange rate', async function () {
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.supply(toWei('1'))

      expect(await cToken.balanceOf(interestPool.address)).to.equal(toWei('1'))
      expect(await cToken.totalSupply()).to.equal(toWei('1'))
    })
  })

  describe('redeemUnderlying()', () => {
    it('should allow a user to withdraw their principal', async function () {
      let startBalance = await token.balanceOf(wallet._address)
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.supply(toWei('1'))

      await interestPool.redeem(toWei('1'))

      expect(await cToken.balanceOf(wallet._address)).to.equal('0')
      expect(await token.balanceOf(wallet._address)).to.equal(startBalance)
    })
  })

  describe('balanceOf()', () => {
    it('should return zero when no interest has accrued', async () => {
      expect((await interestPool.balanceOf(wallet._address)).toString()).to.equal(toWei('0'))
    })

    it('should return the amount of interest available', async function () {
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.supply(toWei('1'))
      
      expect(await cToken.balanceOf(interestPool.address)).to.equal(toWei('1'))
      expect(await interestPool.cTokenBalanceOf(wallet._address)).to.equal(toWei('1'))

      await cToken.accrueCustom(toWei('2'))

      debug('checking cToken balance...')
      // console.log('check balance of interest pool')
      expect(await cToken.balanceOf(interestPool.address)).to.equal(toWei('1'))

      debug('checking interestPool balance...')
      // console.log('check balance of wallet')
      expect(await interestPool.balanceOf(wallet._address)).to.equal(toWei('3'))
    })
  })
})
