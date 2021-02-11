const { expect } = require("chai")
const hardhat = require('hardhat')
const { ethers } = hardhat

let overrides = { gasLimit: 9500000 }

describe('PeriodicPrizeStrategyListener', () => {

  let listener
  let wallet
  let provider

  beforeEach(async () => {
    [wallet] = await hardhat.ethers.getSigners()
    provider = hardhat.ethers.provider
   
    const PeriodicPrizeStrategyListenerFactory =  await hre.ethers.getContractFactory("PeriodicPrizeStrategyListenerStub", wallet, overrides)
    listener = await PeriodicPrizeStrategyListenerFactory.deploy()
    await listener.deployed()
  })

  describe('supportsInterface()', () => {
    it('should support the prize strategy interface', async () => {
      expect(await listener.supportsInterface(ethers.utils.solidityKeccak256(['string'], ['afterPrizePoolAwarded(uint256,uint256)']).substring(0, 10)))
      expect(await listener.supportsInterface(ethers.utils.solidityKeccak256(['string'], ['supportsInterface(bytes4)']).substring(0, 10)))
    })
  })
})
