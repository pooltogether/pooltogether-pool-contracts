const { expect } = require("chai");
const PrizeStrategyProxyFactory = require('../build/PrizeStrategyProxyFactory.json')
const buidler = require('./helpers/buidler')
const { deployContract } = require('ethereum-waffle')

let overrides = { gasLimit: 20000000 }

describe('PrizeStrategyProxyFactory', () => {

  let wallet, wallet2

  let provider

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider

    factory = await deployContract(wallet, PrizeStrategyProxyFactory, [], overrides)
    await factory.initialize(overrides)
  })

  describe('create()', () => {
    it('should create a new prize strategy', async () => {
      let tx = await factory.create(overrides)
      let receipt = await provider.getTransactionReceipt(tx.hash)
      let event = factory.interface.parseLog(receipt.logs[0])
      expect(event.name).to.equal('ProxyCreated')
    })
  })
})
