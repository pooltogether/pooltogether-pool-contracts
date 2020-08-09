const { expect } = require("chai");
const CompoundPrizePoolProxyFactory = require('../build/CompoundPrizePoolProxyFactory.json')
const buidler = require('@nomiclabs/buidler')
const { deployContract } = require('ethereum-waffle')

let overrides = { gasLimit: 20000000 }

describe('CompoundPrizePoolProxyFactory', () => {

  let wallet, wallet2

  let provider

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider

    factory = await deployContract(wallet, CompoundPrizePoolProxyFactory, [], overrides)
  })

  describe('create()', () => {
    it('should create a new prize pool', async () => {
      let tx = await factory.create(overrides)
      let receipt = await provider.getTransactionReceipt(tx.hash)
      let event = factory.interface.parseLog(receipt.logs[0])
      expect(event.name).to.equal('ProxyCreated')
    })
  })
})
