import { deployContract } from 'ethereum-waffle'
import CompoundInterestPoolFactory from '../build/CompoundInterestPoolFactory.json'
import CompoundInterestPool from '../build/CompoundInterestPool.json'
import { expect } from 'chai'
import { ethers } from './helpers/ethers'
import buidler from './helpers/buidler'

const toWei = ethers.utils.parseEther

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('CompoundInterestPool contract', () => {
  
  let interestPoolFactory: any

  let wallet: any
  let allocator: any
  let otherWallet: any

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()
    interestPoolFactory = await deployContract(wallet, CompoundInterestPoolFactory, [])
    await interestPoolFactory.initialize()
  })

  describe('createCompoundInterestPool()', () => {
    it('should create a new interest pool', async () => {
      let tx = await interestPoolFactory.createCompoundInterestPool()
      let receipt = await buidler.ethers.provider.getTransactionReceipt(tx.hash)
      // @ts-ignore
      let lastLog = receipt.logs[receipt.logs.length - 1]
      let event = interestPoolFactory.interface.events.CompoundInterestPoolCreated.decode(lastLog.data, lastLog.topics)

      let interestPoolAddress = event.interestPool

      let interestPool = new ethers.Contract(interestPoolAddress, CompoundInterestPool.abi, wallet)

      expect(await interestPool.cToken()).to.equal('0x0000000000000000000000000000000000000000')
    })
  })
})
