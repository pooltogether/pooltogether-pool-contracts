const { expect } = require("chai");
const MultipleWinnersProxyFactory = require('../build/MultipleWinnersProxyFactory.json')
const hardhat = require('@nomiclabs/hardhat')
const { deployContract } = require('ethereum-waffle')

let overrides = { gasLimit: 20000000 }

describe('MultipleWinnersProxyFactory', () => {

  let wallet, wallet2

  let provider

  beforeEach(async () => {
    [wallet, wallet2] = await hardhat.ethers.getSigners()
    provider = hardhat.ethers.provider

    factory = await deployContract(wallet, MultipleWinnersProxyFactory, [], overrides)
  })

  describe('create()', () => {
    it('should create a new multiple winners strat', async () => {
      let tx = await factory.create(overrides)
      let receipt = await provider.getTransactionReceipt(tx.hash)
      let event = factory.interface.parseLog(receipt.logs[0])
      expect(event.name).to.equal('ProxyCreated')
    })
  })
})
