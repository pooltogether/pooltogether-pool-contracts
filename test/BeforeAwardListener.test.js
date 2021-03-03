const { expect } = require("chai")
const hardhat = require('hardhat')
const { ethers } = hardhat

let overrides = { gasLimit: 9500000 }

describe('BeforeAwardListener', () => {

  let listener
  let wallet
  let provider

  beforeEach(async () => {
    [wallet] = await hardhat.ethers.getSigners()
    provider = hardhat.ethers.provider
   
    const BeforeAwardListenerFactory =  await hre.ethers.getContractFactory("BeforeAwardListenerStub", wallet, overrides)
    listener = await BeforeAwardListenerFactory.deploy()
    await listener.deployed()
  })

  describe('supportsInterface()', () => {
    it('should support the BeforeAwardInterface', async () => {
      expect(await listener.supportsInterface(ethers.utils.solidityKeccak256(['string'], ['beforePrizePoolAwarded(uint256,uint256)']).substring(0, 10)))
      expect(await listener.supportsInterface(ethers.utils.solidityKeccak256(['string'], ['supportsInterface(bytes4)']).substring(0, 10)))
    })
  })
})
