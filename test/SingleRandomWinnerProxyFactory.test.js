const { expect } = require("chai")
const SingleRandomWinnerProxyFactory = require('../build/SingleRandomWinnerProxyFactory.json')
const hardhat = require('@nomiclabs/hardhat')
const { deployContract } = require('ethereum-waffle')

let overrides = { gasLimit: 20000000 }

describe('SingleRandomWinnerProxyFactory', () => {

  let wallet, wallet2

  let provider

  beforeEach(async () => {
    [wallet, wallet2] = await hardhat.ethers.getSigners()
    provider = hardhat.ethers.provider

    factory = await deployContract(wallet, SingleRandomWinnerProxyFactory, [], overrides)
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
