const { expect } = require("chai");
const CompoundPrizePoolProxyFactory = require('../build/CompoundPrizePoolProxyFactory.json')
const buidler = require('./helpers/buidler')
const { deployContract } = require('ethereum-waffle')

describe('CompoundPrizePoolProxyFactory', () => {

  let wallet, wallet2

  let provider

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider

    factory = await deployContract(wallet, CompoundPrizePoolProxyFactory, [])
    await factory.initialize()
  })

  describe('create()', () => {
    it('should create a new prize pool', async () => {
      let tx = await factory.create()
      let receipt = await provider.getTransactionReceipt(tx.hash)
      let event = factory.interface.parseLog(receipt.logs[0])
      expect(event.name).to.equal('ProxyCreated')
    })
  })
})
