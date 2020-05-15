import { deployContract } from 'ethereum-waffle'
import { deploy1820 } from 'deploy-eip-1820'
import CompoundYieldService from '../build/CompoundYieldService.json'
import ERC20Mintable from '../build/ERC20Mintable.json'
import CTokenMock from '../build/CTokenMock.json'
import ModuleManager from '../build/ModuleManager.json'
import { expect } from 'chai'
import { ethers } from './helpers/ethers'
import { balanceOf } from './helpers/balanceOf'
import buidler from './helpers/buidler'

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:CompoundYieldService.test')

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('CompoundYieldService contract', () => {
  
  let yieldService: any
  let token: any
  let cToken: any
  let moduleManager: any

  let wallet: any
  let allocator: any
  let otherWallet: any

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()

    debug('deploying contracts...')

    await deploy1820(wallet)

    yieldService = await deployContract(wallet, CompoundYieldService, [])
    moduleManager = await deployContract(wallet, ModuleManager, [])
    await moduleManager.construct()

    token = await deployContract(wallet, ERC20Mintable, [])
    cToken = await deployContract(wallet, CTokenMock, [
      token.address, ethers.utils.parseEther('0.01')
    ])

    debug('initializing yield service...')

    await yieldService.initialize(
      cToken.address
    )

    debug({ owner: await yieldService.owner(), wallet: wallet._address });
    
    debug('setting manager on yield service...')

    await yieldService.setManager(moduleManager.address)
    
    debug('enable yield service module...')
    
    await moduleManager.enableModule(yieldService.address)
    expect(await moduleManager.isModuleEnabled(yieldService.address)).to.be.true

    debug('enable wallet as module...')

    await moduleManager.enableModule(wallet._address)
    expect(await moduleManager.isModuleEnabled(wallet._address)).to.be.true
    await token.mint(wallet._address, ethers.utils.parseEther('100000'))
  })

  describe('initialize()', () => {
    xit('should set all the vars', async () => {
      expect(await yieldService.cToken()).to.equal(cToken.address)
    })
  })

  describe('supply()', () => {
    it('should give the first depositer tokens at the initial exchange rate', async function () {
      debug('approve')
      await token.approve(yieldService.address, toWei('1'))
      
      debug('supply')
      await yieldService.supply(wallet._address, toWei('1'))

      // debug('balanceof')
      // expect(await balanceOf(cToken, moduleManager.address)).to.equal(toWei('1'))

      debug('totalSupply')
      expect(await cToken.totalSupply()).to.equal(toWei('1'))
    })
  })

  describe('redeemUnderlying()', () => {
    xit('should allow a user to withdraw their principal', async function () {
      let startBalance = await token.balanceOf(wallet._address)
      await token.approve(yieldService.address, toWei('1'))
      await yieldService.supply(toWei('1'))

      await yieldService.redeem(toWei('1'))

      expect(await cToken.balanceOf(wallet._address)).to.equal('0')
      expect(await token.balanceOf(wallet._address)).to.equal(startBalance)
    })
  })

  describe('balanceOf()', () => {
    xit('should return zero when no interest has accrued', async () => {
      expect((await balanceOf(yieldService, wallet._address)).toString()).to.equal(toWei('0'))
    })

    xit('should return the amount of interest available', async function () {
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
