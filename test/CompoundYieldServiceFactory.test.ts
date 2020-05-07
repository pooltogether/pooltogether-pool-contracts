import { deployContract } from 'ethereum-waffle'
import CompoundYieldServiceFactory from '../build/CompoundYieldServiceFactory.json'
import CompoundYieldService from '../build/CompoundYieldService.json'
import { expect } from 'chai'
import { ethers } from './helpers/ethers'
import buidler from './helpers/buidler'

const toWei = ethers.utils.parseEther

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('CompoundYieldService contract', () => {
  
  let yieldServiceFactory: any

  let wallet: any
  let allocator: any
  let otherWallet: any

  beforeEach(async () => {
    [wallet, allocator, otherWallet] = await buidler.ethers.getSigners()
    yieldServiceFactory = await deployContract(wallet, CompoundYieldServiceFactory, [])
    await yieldServiceFactory.initialize()
  })

  describe('createCompoundYieldService()', () => {
    it('should create a new interest pool', async () => {
      let tx = await yieldServiceFactory.createCompoundYieldService()
      let receipt = await buidler.ethers.provider.getTransactionReceipt(tx.hash)
      // @ts-ignore
      let lastLog = receipt.logs[receipt.logs.length - 1]
      let event = yieldServiceFactory.interface.events.CompoundYieldServiceCreated.decode(lastLog.data, lastLog.topics)

      let yieldServiceAddress = event.yieldService

      let yieldService = new ethers.Contract(yieldServiceAddress, CompoundYieldService.abi, wallet)

      expect(await yieldService.cToken()).to.equal('0x0000000000000000000000000000000000000000')
    })
  })
})
