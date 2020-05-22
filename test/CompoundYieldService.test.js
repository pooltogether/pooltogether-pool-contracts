const { deployContract } = require('ethereum-waffle')
const { deploy1820 } = require('deploy-eip-1820')
const CompoundYieldService = require('../build/CompoundYieldService.json')
const ERC20Mintable = require('../build/ERC20Mintable.json')
const CTokenMock = require('../build/CTokenMock.json')
const ModuleManagerHarness = require('../build/ModuleManagerHarness.json')
const { expect } = require('chai')
const { ethers } = require('./helpers/ethers')
const { balanceOf } = require('./helpers/balanceOf')
const { call } = require('./helpers/call')
const buidler = require('./helpers/buidler')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:CompoundYieldService.test')

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('CompoundYieldService contract', () => {
  
  let yieldService
  let token
  let cToken
  let moduleManager

  let wallet
  let allocator
  let otherWallet

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()

    debug('deploying contracts...')

    await deploy1820(wallet)

    moduleManager = await deployContract(wallet, ModuleManagerHarness, [])
    await moduleManager.initialize()

    token = await deployContract(wallet, ERC20Mintable, [])
    cToken = await deployContract(wallet, CTokenMock, [
      token.address, ethers.utils.parseEther('0.01')
    ])
    yieldService = await deployContract(wallet, CompoundYieldService, [])

    debug('enable yield service module...')

    await moduleManager.enableModule(yieldService.address)

    debug('initializing yield service...')

    await yieldService.initialize(
      moduleManager.address,
      cToken.address
    )

    debug({ owner: await yieldService.owner(), wallet: wallet._address });
    
    expect(await moduleManager.isModuleEnabled(yieldService.address)).to.be.true

    debug('enable wallet as module...')

    await moduleManager.enableModule(wallet._address)
    expect(await moduleManager.isModuleEnabled(wallet._address)).to.be.true
    await token.mint(wallet._address, ethers.utils.parseEther('100000'))
  })

  describe('initialize()', () => {
    it('should set all the vars', async () => {
      expect(await yieldService.cToken()).to.equal(cToken.address)
    })
  })

  describe('supply()', () => {
    it('should fail if the user has not approved', async () => {
      expect(yieldService.supply(wallet._address, toWei('1'))).to.be.revertedWith('could not transferFrom')
    })

    it('should give the first depositer tokens at the initial exchange rate', async function () {
      await token.approve(yieldService.address, toWei('1'))
      
      await yieldService.supply(wallet._address, toWei('1'))

      expect(await balanceOf(cToken, yieldService.address)).to.equal(toWei('1'))

      expect(await cToken.totalSupply()).to.equal(toWei('1'))
    })
  })

  describe('redeemUnderlying()', () => {
    it('should allow a user to withdraw their principal', async function () {
      let startBalance = await token.balanceOf(wallet._address)
      await token.approve(yieldService.address, toWei('1'))
      await yieldService.supply(wallet._address, toWei('1'))

      await yieldService.redeem(wallet._address, toWei('1'))

      expect(await cToken.balanceOf(wallet._address)).to.equal('0')
      expect(await token.balanceOf(wallet._address)).to.equal(startBalance)
    })
  })

  describe('balance()', () => {
    it('should return zero no deposits have been made', async () => {
      expect((await call(yieldService, 'balance')).toString()).to.equal(toWei('0'))
    })

    it('should return the balance when a deposit has been made', async function () {
      await token.approve(yieldService.address, toWei('1'))
      await yieldService.supply(wallet._address, toWei('1'))

      expect(await call(yieldService, 'balance')).to.equal(toWei('1'))
    })

    it('should return what has been deposited, plus interest', async () => {
      await token.approve(yieldService.address, toWei('1'))
      await yieldService.supply(wallet._address, toWei('1'))

      expect(await call(yieldService, 'balance')).to.equal(toWei('1'))

      await cToken.accrue();

      expect(await call(yieldService, 'balance')).to.be.gt(toWei('1'))
    })
  })

  describe('accountedBalance()', () => {
    it('should return zero when nothing is available', async () => {
      expect((await call(yieldService, 'accountedBalance')).toString()).to.equal(toWei('0'))
    })

    it('should return what has been deposited, excluding interest', async () => {
      await token.approve(yieldService.address, toWei('1'))
      await yieldService.supply(wallet._address, toWei('1'))

      expect(await call(yieldService, 'accountedBalance')).to.equal(toWei('1'))

      await cToken.accrue();

      expect(await call(yieldService, 'accountedBalance')).to.equal(toWei('1'))
    })
  })

  describe('unaccountedBalance()', () =>  {
    it('should return the newly accrued interest', async () => {
      await token.approve(yieldService.address, toWei('1'))
      await yieldService.supply(wallet._address, toWei('1'))

      expect(await call(yieldService, 'unaccountedBalance')).to.equal(toWei('0'))

      await cToken.accrueCustom(toWei('2'));

      expect(await call(yieldService, 'unaccountedBalance')).to.equal(toWei('2'))
    })

    it('should handle the case when there is less balance available than what has been accounted for', async () => {
      await token.approve(yieldService.address, toWei('1'))
      await yieldService.supply(wallet._address, toWei('1'))

      await cToken.burn(toWei('0.1'));

      expect(await call(yieldService, 'unaccountedBalance')).to.equal(toWei('0'))
    })
  })
})
