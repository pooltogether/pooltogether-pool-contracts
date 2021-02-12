const { expect } = require("chai")
const hardhat = require('hardhat')

let overrides = { gasLimit: 9500000 }

describe('StakePrizePoolProxyFactory', () => {

  let wallet

  let provider

  beforeEach(async () => {
    [wallet] = await hardhat.ethers.getSigners()
    provider = hardhat.ethers.provider
   
    const StakePrizePoolProxyFactory =  await hre.ethers.getContractFactory("StakePrizePoolProxyFactory", wallet, overrides)
    factory = await StakePrizePoolProxyFactory.deploy()
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
