const { expect } = require("chai")
const hardhat = require('hardhat')


let overrides = { gasLimit: 9500000 }

describe('SingleRandomWinnerProxyFactory', () => {

  let wallet, wallet2

  let provider

  beforeEach(async () => {
    [wallet, wallet2] = await hardhat.ethers.getSigners()
    provider = hardhat.ethers.provider
   
    const SingleRandomWinnerProxyFactory =  await hre.ethers.getContractFactory("SingleRandomWinnerProxyFactory", wallet, overrides)
    factory = await SingleRandomWinnerProxyFactory.deploy()
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
