const { expect } = require("chai");
const ReserveProxy = require('../build/ReserveProxy.json')
const ReserveInterface = require('../build/ReserveInterface.json')
const buidler = require('@nomiclabs/buidler')
const { deployContract } = require('ethereum-waffle')
const { deployMockContract } = require('./helpers/deployMockContract')
const { AddressZero } = require("ethers").constants

const overrides = { gasLimit: 20000000 }

const debug = require('debug')('ptv3:Reserve.test')

describe('ReserveProxy', () => {

  let wallet, wallet2

  let provider
  let reserve, strategy

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider

    // just fake it so that we can call it as if we *were* the prize strategy

    strategy = await deployMockContract(wallet, ReserveInterface.abi)
    reserve = await deployContract(wallet, ReserveProxy, [], overrides)
  })

  describe('setStrategy()', () => {
    it('should set the strategy', async () => {
      await expect(reserve.setStrategy(strategy.address))
        .to.emit(reserve, 'ReserveStrategySet')
        .withArgs(strategy.address)

      expect(await reserve.strategy()).to.equal(strategy.address)
    })

    it('should not be callable by anyone else', async () => {
      await expect(reserve.connect(wallet2).setStrategy(strategy.address))
        .to.be.revertedWith("Ownable: caller is not the owner")
    })
  })

  describe('reserveRecipient()', () => {
    it('should return address 0 if no strategy is set', async () => {
      expect(await reserve.reserveRecipient(AddressZero)).to.equal(AddressZero)
    })

    it('should delegate to the strategy if set', async () => {
      await reserve.setStrategy(strategy.address)
      await strategy.mock.reserveRecipient.returns(wallet._address)

      expect(await reserve.reserveRecipient(AddressZero)).to.equal(wallet._address)
    })
  })

  describe('reserveRateMantissa()', () => {
    it('should return 0 if no strategy is set', async () => {
      expect(await reserve.reserveRateMantissa(AddressZero)).to.equal('0')
    })

    it('should delegate to the strategy if set', async () => {
      await reserve.setStrategy(strategy.address)
      await strategy.mock.reserveRateMantissa.returns('1000')

      expect(await reserve.reserveRateMantissa(AddressZero)).to.equal('1000')
    })
  })
})
