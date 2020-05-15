import { deployContract } from 'ethereum-waffle';
import { deploy1820 } from 'deploy-eip-1820'
import Loyalty from '../build/Loyalty.json';
import Forwarder from '../build/Forwarder.json'
import { ethers } from './helpers/ethers'
import { expect } from 'chai'
import buidler from './helpers/buidler'

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:Loyalty.test')

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('Loyalty contract', function() {

  let token: any
  let forwarder: any

  let wallet: any
  let otherWallet: any

  beforeEach(async () => {
    [wallet, otherWallet] = await buidler.ethers.getSigners()
    await deploy1820(wallet)
    forwarder = await deployContract(wallet, Forwarder, [])
    token = await deployContract(wallet, Loyalty, [])
    debug('initializing...')
    await token['initialize(string,string,address)']("", "", forwarder.address)
    await token.setManager(wallet._address)
  })

  describe('supply', () => {
    it('should give a user tokens', async () => {
      debug('supplying...')
      await token.supply(otherWallet._address, toWei('100'))
      // starts at parity
      expect(await token.balanceOf(otherWallet._address)).to.equal(toWei('100'))
      expect(await token.collateral()).to.equal(toWei('100'))
    })
  })

  describe('redeem', () => {
    it('should let a user pull their tokens out', async () => {
      await token.supply(otherWallet._address, toWei('100'))
      
      await token.redeem(otherWallet._address, toWei('100'))

      // starts at parity
      expect(await token.balanceOf(otherWallet._address)).to.equal(toWei('0'))
      expect(await token.collateral()).to.equal(toWei('0'))
    })
  })

  describe('reward', async () => {
    it('should increase for all users', async () => {
      await token.supply(otherWallet._address, toWei('100'))
      await token.supply(wallet._address, toWei('100'))

      await token.reward(toWei('200'))

      // starts at parity
      expect(await token.collateral()).to.equal(toWei('400'))
      expect(await token.balanceOfUnderlying(otherWallet._address)).to.equal(toWei('200'))
      expect(await token.balanceOfUnderlying(wallet._address)).to.equal(toWei('200'))
    })
  })
});
