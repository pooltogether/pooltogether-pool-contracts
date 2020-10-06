const { expect } = require("chai");
const Reserve = require('../build/Reserve.json')
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

  describe('setRecipient()', () => {
    it('should set the recipient', async () => {
      await expect(reserve.setRecipient(wallet._address))
        .to.emit(reserve, 'ReserveRecipientSet')
        .withArgs(wallet._address)

      expect(await reserve.recipient()).to.equal(wallet._address)
    })

    it('should not be callable by anyone else', async () => {
      await expect(reserve.connect(wallet2).setRecipient(wallet._address))
        .to.be.revertedWith("Ownable: caller is not the owner")
    })
  })

  describe('reserveRecipient()', () => {
    it('should return address 0 if no recipient is set', async () => {
      expect(await reserve.reserveRecipient(AddressZero)).to.equal(AddressZero)
    })

    it('should return the recipient if set', async () => {
      await reserve.setRecipient(wallet._address)

      expect(await reserve.reserveRecipient(AddressZero)).to.equal(wallet._address)
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
