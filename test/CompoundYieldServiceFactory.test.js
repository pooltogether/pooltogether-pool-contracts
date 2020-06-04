const { deployContract } = require('ethereum-waffle')
const CompoundYieldServiceFactory = require('../build/CompoundYieldServiceFactory.json')
const CompoundYieldService = require('../build/CompoundYieldService.json')
const { expect } = require('chai')
const { ethers } = require('./helpers/ethers')
const buidler = require('./helpers/buidler')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:CompoundYieldServiceFactory.test')

const overrides = { gasLimit: 40000000 }

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('CompoundYieldService contract', () => {
  
  let yieldServiceFactory
  let wallet
  let allocator
  let otherWallet

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()
    yieldServiceFactory = await deployContract(wallet, CompoundYieldServiceFactory, [], overrides)
    await yieldServiceFactory.initialize(overrides)
  })

  describe('createCompoundYieldService()', () => {
    it('should create a new interest pool', async () => {
      let tx = await yieldServiceFactory.createCompoundYieldService(overrides)
      let receipt = await buidler.ethers.provider.getTransactionReceipt(tx.hash)
      let logs = receipt.logs.map(log => yieldServiceFactory.interface.parseLog(log))
      debug({ logs })
      
      let ProxyCreated = logs[0]
      expect(ProxyCreated.name).to.equal('ProxyCreated')

      let yieldService = await buidler.ethers.getContractAt('CompoundYieldService', ProxyCreated.values.proxy, wallet)

      expect(await yieldService.cToken()).to.equal('0x0000000000000000000000000000000000000000')
    })
  })
})
