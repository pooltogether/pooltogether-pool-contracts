const { deployContract, deployMockContract } = require('ethereum-waffle')
const { expect } = require('chai')

const CompoundYieldServiceHarness = require('../build/CompoundYieldServiceHarness.json')
const CTokenInterface = require('../build/CTokenInterface.json')
const IERC20 = require('../build/IERC20.json')
const PrizePoolModuleManager = require('../build/PrizePoolModuleManager.json')

const { ethers } = require('./helpers/ethers')
const { balanceOf } = require('./helpers/balanceOf')
const { call } = require('./helpers/call')
const buidler = require('./helpers/buidler')
const {
  YIELD_SERVICE_INTERFACE_HASH
} = require('../js/constants')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:CompoundYieldService.test')

const overrides = { gasLimit: 40000000 }

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('CompoundYieldService contract', () => {
  
  let yieldService
  let token
  let cToken
  let manager

  let wallet
  let allocator
  let otherWallet

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()

    manager = await deployMockContract(wallet, PrizePoolModuleManager.abi, overrides)
    token = await deployMockContract(wallet, IERC20.abi, overrides)
    cToken = await deployMockContract(wallet, CTokenInterface.abi, overrides)

    await cToken.mock.underlying.returns(token.address)

    await manager.mock.enableModuleInterface.withArgs(YIELD_SERVICE_INTERFACE_HASH).returns()
    await manager.mock.isModuleEnabled.withArgs(wallet._address).returns(true)
    
    yieldService = await deployContract(wallet, CompoundYieldServiceHarness, [], overrides)

    debug('initializing yield service...')

    await yieldService.initialize(
      manager.address,
      cToken.address,
      overrides
    )
  })

  describe('initialize()', () => {
    it('should set all the vars', async () => {
      debug('starting initialize()....')
      expect(await yieldService.cToken()).to.equal(cToken.address)
      debug('finishing initialize()....')
    })
  })

  describe('supply()', () => {
    it('should fail if the user has not approved', async () => {
      await token.mock.transferFrom.withArgs(wallet._address, yieldService.address, toWei('1')).reverts()

      debug('starting supply()....')
      expect(yieldService.supply(toWei('1'))).to.be.revertedWith('Mock revert')
      debug('finishing supply()....')
    })

    it('should give the first depositer tokens at the initial exchange rate', async function () {
      await token.mock.transferFrom.withArgs(wallet._address, yieldService.address, toWei('1')).returns(true)
      await token.mock.approve.withArgs(cToken.address, toWei('1')).returns(true)
      await cToken.mock.mint.withArgs(toWei('1')).returns(0)
      
      await expect(yieldService.supply(toWei('1')))
        .to.emit(yieldService, 'PrincipalSupplied')
        .withArgs(wallet._address, toWei('1'))

      expect(await yieldService.accountedBalance()).to.equal(toWei('1'))
    })
  })

  describe('redeemUnderlying()', () => {
    it('should allow redeeming principal', async function () {
      await yieldService.setAccountedBalance(toWei('1'))

      await cToken.mock.redeemUnderlying.withArgs(toWei('1')).returns('0')
      await token.mock.transfer.withArgs(wallet._address, toWei('1')).returns(true)

      await expect(yieldService.redeem(toWei('1')))
        .to.emit(yieldService, 'PrincipalRedeemed')
        .withArgs(wallet._address, toWei('1'));
    })
  })

  describe('capture()', () => {
    it('should capture excess interest', async () => {
      await cToken.mock.balanceOfUnderlying.returns(toWei('10'))

      await expect(yieldService.capture(toWei('8')))
        .to.emit(yieldService, 'PrincipalCaptured')
        .withArgs(wallet._address, toWei('8'))

      expect(await yieldService.accountedBalance()).to.equal(toWei('8'))
    })

    it('should not allow captures greater than available', async () => {
      await cToken.mock.balanceOfUnderlying.returns(toWei('10'))

      await expect(yieldService.capture(toWei('20'))).to.be.revertedWith('insuff')
    })
  })

  describe('balance()', () => {
    it('should return zero if no deposits have been made', async () => {
      await cToken.mock.balanceOfUnderlying.returns(toWei('11'))

      expect((await call(yieldService, 'balance')).toString()).to.equal(toWei('11'))
    })
  })

  describe('accountedBalance()', () => {
    it('should return zero when nothing is available', async () => {
      expect((await call(yieldService, 'accountedBalance')).toString()).to.equal(toWei('0'))
    })

    it('should return what has been deposited, excluding interest', async () => {
      await yieldService.setAccountedBalance(toWei('99'))

      expect(await call(yieldService, 'accountedBalance')).to.equal(toWei('99'))
    })
  })

  describe('unaccountedBalance()', () =>  {
    it('should return the newly accrued interest', async () => {
      await cToken.mock.balanceOfUnderlying.returns(toWei('10'))
      await yieldService.setAccountedBalance(toWei('9'))
      expect(await call(yieldService, 'unaccountedBalance')).to.equal(toWei('1'))
    })

    it('should handle the case when there is less balance available than what has been accounted for', async () => {
      await cToken.mock.balanceOfUnderlying.returns(toWei('10'))
      await yieldService.setAccountedBalance(toWei('11'))
      expect(await call(yieldService, 'unaccountedBalance')).to.equal(toWei('0'))
    })
  })
})
