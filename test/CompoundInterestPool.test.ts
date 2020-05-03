import { deployContract } from 'ethereum-waffle'
import CompoundInterestPool from '../build/CompoundInterestPool.json'
import ERC20Mintable from '../build/ERC20Mintable.json'
import CTokenMock from '../build/CTokenMock.json'
import ControlledToken from '../build/ControlledToken.json'
import { expect } from 'chai'
import { ethers } from 'ethers'
const buidler = require("@nomiclabs/buidler")

const toWei = ethers.utils.parseEther

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('InterestPool contract', () => {
  
  let interestPool: any
  let token: any
  let principalToken: any
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
    principalToken = await deployContract(wallet, ControlledToken, [])
    await principalToken.initialize(
      'Ticket',
      'TICK',
      interestPool.address
    )
    await interestPool.initialize(
      cToken.address,
      principalToken.address
    )
    await token.mint(wallet._address, ethers.utils.parseEther('100000'))
  })

  describe('initialize()', () => {
    it('should set all the vars', async () => {
      expect(await interestPool.principal()).to.equal(principalToken.address)
      expect(await interestPool.cToken()).to.equal(cToken.address)
    })
  })

  describe('supplyUnderlying()', () => {
    it('should give the first depositer tokens at the initial exchange rate', async function () {
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.supplyUnderlying(toWei('1'))

      expect(await principalToken.balanceOf(wallet._address)).to.equal(toWei('1'))
      expect(await principalToken.totalSupply()).to.equal(toWei('1'))
    })
  })

  describe('redeemUnderlying()', () => {
    it('should allow a user to withdraw their principal', async function () {
      let startBalance = await token.balanceOf(wallet._address)
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.supplyUnderlying(toWei('1'))

      expect(await principalToken.balanceOf(wallet._address)).to.equal(toWei('1'))
      expect(startBalance.sub(await token.balanceOf(wallet._address))).to.equal(toWei('1'))

      // let cTokenBalance = await interestPool.cTokenBalanceOf(wallet._address)
      // let poolBalance = await cToken.balanceOf(interestPool.address)

      // console.log({ cTokenBalance: cTokenBalance.toString(), poolBalance: poolBalance.toString() })

      await interestPool.redeemUnderlying(toWei('1'))

      expect(await principalToken.balanceOf(wallet._address)).to.equal('0')
      expect(await token.balanceOf(wallet._address)).to.equal(startBalance)
    })
  })

  describe('balanceOfUnderlying()', () => {
    it('should return zero when no interest has accrued', async () => {
      expect((await interestPool.balanceOfUnderlying(wallet._address)).toString()).to.equal(toWei('0'))
    })

    it('should return the amount of interest available', async function () {
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.supplyUnderlying(toWei('1'))
      
      expect(await cToken.balanceOf(interestPool.address)).to.equal(toWei('1'))
      expect(await interestPool.cTokenBalanceOf(wallet._address)).to.equal(toWei('1'))

      await cToken.accrueCustom(toWei('2'))
      // console.log('check balance of interest pool')
      expect(await cToken.balanceOfUnderlying(interestPool.address)).to.equal(toWei('3'))
      // console.log('check balance of wallet')
      expect(await interestPool.balanceOfUnderlying(wallet._address)).to.equal(toWei('3'))
    })
  })

  describe('mintPrincipal()', () => {
    it('should allow a user to mint principal when they have interest available', async () => {
      // supply the interest pool
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.supplyUnderlying(toWei('1'))
      expect(await principalToken.balanceOf(wallet._address)).to.equal(toWei('1'))

      // accrue interest
      await cToken.accrueCustom(toWei('2'))

      // balance should include interest
      expect((await interestPool.balanceOfUnderlying(wallet._address)).toString()).to.equal(toWei('3'))

      // now we mint principal
      await interestPool.mintPrincipal(toWei('2'))

      expect(await interestPool.balanceOfUnderlying(wallet._address)).to.equal(toWei('3'))
      expect(await principalToken.balanceOf(wallet._address)).to.equal(toWei('3'))
    })

    it('cannot mint more principal than available interest', async () => {
      await token.approve(interestPool.address, toWei('1'))
      await interestPool.supplyUnderlying(toWei('1'))
      await cToken.accrueCustom(toWei('1'))
      await expect(interestPool.connect(allocator).mintPrincipal(toWei('2'))).to.be.revertedWith('exceed-interest')
    })
  })
})
