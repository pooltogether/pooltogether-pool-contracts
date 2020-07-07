const { deployContract, deployMockContract } = require('ethereum-waffle')
const { expect } = require('chai')

const CompoundYieldServiceHarness = require('../build/CompoundYieldServiceHarness.json')
const CTokenInterface = require('../build/CTokenInterface.json')
const IERC20 = require('../build/IERC20.json')

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

  let wallet
  let allocator
  let otherWallet

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()

    token = await deployMockContract(wallet, IERC20.abi, overrides)
    cToken = await deployMockContract(wallet, CTokenInterface.abi, overrides)

    await cToken.mock.underlying.returns(token.address)

    yieldService = await deployContract(wallet, CompoundYieldServiceHarness, [], overrides)

    debug('initializing yield service...')

    await yieldService.initialize(
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
    it('should give the first depositer tokens at the initial exchange rate', async function () {
      await token.mock.transferFrom.withArgs(wallet._address, yieldService.address, toWei('1')).returns(true)
      await token.mock.approve.withArgs(cToken.address, toWei('1')).returns(true)
      await cToken.mock.mint.withArgs(toWei('1')).returns(0)
      
      await expect(yieldService.supply(toWei('1')))
        .to.emit(yieldService, 'PrincipalSupplied')
        .withArgs(wallet._address, toWei('1'))
    })
  })

  describe('redeem()', () => {
    it('should allow redeeming principal', async function () {
      await cToken.mock.redeemUnderlying.withArgs(toWei('1')).returns('0')
      await token.mock.transfer.withArgs(wallet._address, toWei('1')).returns(true)

      await expect(yieldService.redeem(toWei('1')))
        .to.emit(yieldService, 'PrincipalRedeemed')
        .withArgs(wallet._address, toWei('1'));
    })
  })

  describe('balance()', () => {
    it('should return zero if no deposits have been made', async () => {
      await cToken.mock.balanceOfUnderlying.returns(toWei('11'))

      expect((await call(yieldService, 'balance')).toString()).to.equal(toWei('11'))
    })
  })
})
