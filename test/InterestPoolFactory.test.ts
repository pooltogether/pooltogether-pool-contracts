import { deployContract } from 'ethereum-waffle'
import InterestPoolFactory from '../build/InterestPoolFactory.json'
import InterestPool from '../build/InterestPool.json'
import { expect } from 'chai'
import { ethers, Contract } from 'ethers'
const buidler = require("@nomiclabs/buidler")

const toWei = ethers.utils.parseEther

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('InterestPool contract', () => {
  
  let interestPoolFactory: any

  let wallet: any
  let allocator: any
  let otherWallet: any

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()
    interestPoolFactory = await deployContract(wallet, InterestPoolFactory, [])
    await interestPoolFactory.initialize()
  })

  describe('createInterestPool()', () => {
    it('should create a new interest pool', async () => {
      let tx = await interestPoolFactory.createInterestPool()
      let receipt = await buidler.ethers.provider.getTransactionReceipt(tx.hash)
      // @ts-ignore
      let lastLog = receipt.logs[receipt.logs.length - 1]
      let event = interestPoolFactory.interface.events.InterestPoolCreated.decode(lastLog.data, lastLog.topics)

      let interestPoolAddress = event.interestPool

      let interestPool = new ethers.Contract(interestPoolAddress, InterestPool.abi, wallet)

      expect(await interestPool.cToken()).to.equal('0x0000000000000000000000000000000000000000')
    })
  })
})
