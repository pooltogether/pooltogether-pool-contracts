const { expect } = require("chai");
const hardhat = require('hardhat')


describe('ControlledTokenProxyFactory', () => {

  let wallet, wallet2

  let provider

  beforeEach(async () => {
    [wallet, wallet2] = await hardhat.ethers.getSigners()
    provider = hardhat.ethers.provider
    const ControlledTokenProxyFactory = await hre.ethers.getContractFactory("ControlledTokenProxyFactory", wallet)
    factory = await ControlledTokenProxyFactory.deploy()
  })

  describe('create()', () => {
    it('should create a new prize strategy', async () => {
      let tx = await factory.create()
      let receipt = await provider.getTransactionReceipt(tx.hash)
      let event = factory.interface.parseLog(receipt.logs[0])
      expect(event.name).to.equal('ProxyCreated')
    })
  })
})
