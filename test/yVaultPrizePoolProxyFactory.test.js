const { expect } = require("chai");
const yVaultPrizePoolProxyFactory = require('../build/yVaultPrizePoolProxyFactory.json')
const hardhat = require('@nomiclabs/hardhat')
const { deployContract } = require('ethereum-waffle')

let overrides = { gasLimit: 20000000 }

describe('yVaultPrizePoolProxyFactory', () => {

  let wallet, wallet2

  let provider

  beforeEach(async () => {
    [wallet, wallet2] = await hardhat.ethers.getSigners()
    provider = hardhat.ethers.provider

    factory = await deployContract(wallet, yVaultPrizePoolProxyFactory, [], overrides)
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
