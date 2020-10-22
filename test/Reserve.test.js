const { expect } = require("chai");
const Reserve = require('../build/Reserve.json')
const PrizePoolInterface = require('../build/PrizePoolInterface.json')
const buidler = require('@nomiclabs/buidler')
const { deployContract } = require('ethereum-waffle')
const { deployMockContract } = require('./helpers/deployMockContract')
const { AddressZero } = require("ethers").constants

const overrides = { gasLimit: 20000000 }

const debug = require('debug')('ptv3:Reserve.test')

describe('Reserve', () => {

  let wallet, wallet2

  let provider
  let reserve

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider

    reserve = await deployContract(wallet, Reserve, [], overrides)
  })

  describe('setRateMantissa()', () => {
    it('should set the rate mantissa', async () => {
      await expect(reserve.setRateMantissa('1000'))
        .to.emit(reserve, 'ReserveRateMantissaSet')
        .withArgs('1000')

      expect(await reserve.rateMantissa()).to.equal('1000')
    })

    it('should not be callable by anyone else', async () => {
      await expect(reserve.connect(wallet2).setRateMantissa('1000'))
        .to.be.revertedWith("Ownable: caller is not the owner")
    })
  })

  describe('withdrawReserve', () => {
    it('should only be callable by the owner', async () => {
      await expect(reserve.connect(wallet2).withdrawReserve(wallet._address, wallet._address))
        .to.be.revertedWith("Ownable: caller is not the owner")
    })

    it('should be callable by the owner', async () => {
      const prizePool = await deployMockContract(wallet, PrizePoolInterface.abi)

      await prizePool.mock.withdrawReserve.withArgs(wallet._address).returns('10')

      await reserve.withdrawReserve(prizePool.address, wallet._address)
    })
  })

  describe('reserveRateMantissa()', () => {
    it('should return 0 if not set', async () => {
      expect(await reserve.reserveRateMantissa(AddressZero)).to.equal('0')
    })

    it('should return if set', async () => {
      await reserve.setRateMantissa('1000')

      expect(await reserve.reserveRateMantissa(AddressZero)).to.equal('1000')
    })
  })
})
