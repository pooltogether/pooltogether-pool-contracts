const { deployContract } = require('ethereum-waffle')
const { deploy1820 } = require('deploy-eip-1820')
const Collateral = require('../build/Collateral.json')
const ModuleManagerHarness = require('../build/ModuleManagerHarness.json')
const Forwarder = require('../build/Forwarder.json')
const { ethers } = require('./helpers/ethers')
const { expect } = require('chai')
const buidler = require('./helpers/buidler')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:Collateral.test')

const overrides = { gasLimit: 40000000 }

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('Collateral contract', function() {

  let collateral
  let forwarder

  let wallet
  let otherWallet

  let registry

  beforeEach(async () => {
    [wallet, otherWallet] = await buidler.ethers.getSigners()
    registry = await deploy1820(wallet)
    moduleManager = await deployContract(wallet, ModuleManagerHarness, [], overrides)
    await moduleManager.initialize(overrides)
    forwarder = await deployContract(wallet, Forwarder, [], overrides)
    collateral = await deployContract(wallet, Collateral, [], overrides)
    await moduleManager.enableModule(collateral.address)
    debug('initializing...')
    await collateral['initialize(address,address,string,string)'](moduleManager.address, forwarder.address, "", "", overrides)

    // add wallet as module for privileged interactions
    await moduleManager.enableModule(wallet._address)
  })

  describe('initialize()', () => {
    it('should have setup correctly', async () => {
      expect(await registry.getInterfaceImplementer(moduleManager.address, '0x21adbc49851dc9a5421ef4d78427664813502289b1576200510e09bc637502d9')).to.equal(collateral.address)
    })
  })

  describe('supply', () => {
    it('should give a user tokens', async () => {
      debug('supplying...')
      await collateral.supply(otherWallet._address, toWei('100'))
      // starts at parity
      expect(await collateral.balanceOf(otherWallet._address)).to.equal(toWei('100'))
      expect(await collateral.collateral()).to.equal(toWei('100'))
    })
  })

  describe('redeem', () => {
    it('should let a user pull their tokens out', async () => {
      await collateral.supply(otherWallet._address, toWei('100'))
      
      await collateral.redeem(otherWallet._address, toWei('100'))

      // starts at parity
      expect(await collateral.balanceOf(otherWallet._address)).to.equal(toWei('0'))
      expect(await collateral.collateral()).to.equal(toWei('0'))
    })
  })

  describe('reward', async () => {
    it('should increase for all users', async () => {
      await collateral.supply(otherWallet._address, toWei('100'))
      await collateral.supply(wallet._address, toWei('100'))

      await collateral.reward(toWei('200'))

      // starts at parity
      expect(await collateral.collateral()).to.equal(toWei('400'))
      expect(await collateral.balanceOfUnderlying(otherWallet._address)).to.equal(toWei('200'))
      expect(await collateral.balanceOfUnderlying(wallet._address)).to.equal(toWei('200'))
    })
  })
});
