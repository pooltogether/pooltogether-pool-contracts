const { deployContract } = require('ethereum-waffle')
const { deploy1820 } = require('deploy-eip-1820')
const Loyalty = require('../build/Loyalty.json')
const ModuleManagerHarness = require('../build/ModuleManagerHarness.json')
const Forwarder = require('../build/Forwarder.json')
const { ethers } = require('./helpers/ethers')
const { expect } = require('chai')
const buidler = require('./helpers/buidler')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:Loyalty.test')

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('Loyalty contract', function() {

  let loyalty
  let forwarder

  let wallet
  let otherWallet

  let registry

  beforeEach(async () => {
    [wallet, otherWallet] = await buidler.ethers.getSigners()
    registry = await deploy1820(wallet)
    moduleManager = await deployContract(wallet, ModuleManagerHarness, [])
    await moduleManager.initialize()
    forwarder = await deployContract(wallet, Forwarder, [])
    loyalty = await deployContract(wallet, Loyalty, [])
    await moduleManager.enableModule(loyalty.address)
    debug('initializing...')
    await loyalty['initialize(address,address,string,string)'](moduleManager.address, forwarder.address, "", "")

    // add wallet as module for privileged interactions
    await moduleManager.enableModule(wallet._address)
  })

  describe('initialize()', () => {
    it('should have setup correctly', async () => {
      expect(await registry.getInterfaceImplementer(moduleManager.address, '0x21adbc49851dc9a5421ef4d78427664813502289b1576200510e09bc637502d9')).to.equal(loyalty.address)
    })
  })

  describe('supply', () => {
    it('should give a user tokens', async () => {
      debug('supplying...')
      await loyalty.supply(otherWallet._address, toWei('100'))
      // starts at parity
      expect(await loyalty.balanceOf(otherWallet._address)).to.equal(toWei('100'))
      expect(await loyalty.collateral()).to.equal(toWei('100'))
    })
  })

  describe('redeem', () => {
    it('should let a user pull their tokens out', async () => {
      await loyalty.supply(otherWallet._address, toWei('100'))
      
      await loyalty.redeem(otherWallet._address, toWei('100'))

      // starts at parity
      expect(await loyalty.balanceOf(otherWallet._address)).to.equal(toWei('0'))
      expect(await loyalty.collateral()).to.equal(toWei('0'))
    })
  })

  describe('reward', async () => {
    it('should increase for all users', async () => {
      await loyalty.supply(otherWallet._address, toWei('100'))
      await loyalty.supply(wallet._address, toWei('100'))

      await loyalty.reward(toWei('200'))

      // starts at parity
      expect(await loyalty.collateral()).to.equal(toWei('400'))
      expect(await loyalty.balanceOfUnderlying(otherWallet._address)).to.equal(toWei('200'))
      expect(await loyalty.balanceOfUnderlying(wallet._address)).to.equal(toWei('200'))
    })
  })
});
