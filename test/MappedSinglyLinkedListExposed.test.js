const { deployContract, deployMockContract } = require('ethereum-waffle')
const MappedSinglyLinkedListExposed = require('../build/MappedSinglyLinkedListExposed.json')

const { ethers } = require('ethers')
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')
const { AddressZero } = require('ethers').constants

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:MappedSinglyLinkedListExposed.test')

let overrides = { gasLimit: 20000000 }

const SENTINAL = '0x0000000000000000000000000000000000000001'

describe('PrizePool contract', function() {

  let list

  beforeEach(async () => {
    [wallet, wallet2, wallet3, wallet4] = await buidler.ethers.getSigners()

    list = await deployContract(wallet, MappedSinglyLinkedListExposed, [[wallet2._address]], overrides)
  })

  describe('initialize()', () => {
    it('should have initialized with a value', async () => {
      expect(await list.contains(wallet2._address)).to.be.true
    })
  })

  describe('addressArray', () =>{
    it('should create an array from addresses', async () => {
      expect(await list.addressArray()).to.deep.equal([wallet2._address])
    })
  })

  describe('addAddress', () => {
    it('should not allow adding the SENTINAL address', async () => {
      await expect(list.addAddress(SENTINAL)).to.be.revertedWith("Invalid address")
    })

    it('should not allow adding a zero address', async () => {
      await expect(list.addAddress(AddressZero)).to.be.revertedWith("Invalid address")
    })

    it('should allow the user to add an address', async () => {
      await list.addAddress(wallet._address)

      expect(await list.addressArray()).to.deep.equal([wallet._address, wallet2._address])
    })
  })

  describe('removeAddress', () => {
    it('should not allow removing the SENTINAL address', async () => {
      await expect(list.removeAddress(SENTINAL, SENTINAL)).to.be.revertedWith("Invalid address")
    })

    it('should not allow removing an address that does not exist', async () => {
      await expect(list.removeAddress(wallet._address, wallet2._address)).to.be.revertedWith("Invalid prevAddress")
    })

    it('should not allow removing a zero address', async () => {
      await expect(list.removeAddress(wallet._address, AddressZero)).to.be.revertedWith("Invalid address")
    })

    it('should allow the user to add an address', async () => {
      await list.addAddress(wallet._address)

      await list.removeAddress(wallet._address, wallet2._address)

      expect(await list.addressArray()).to.deep.equal([wallet._address])
      expect(await list.contains(wallet2._address)).to.be.false
    })
  })

  describe('clearAll', () =>{
    it('should clear the list', async () => {
      await list.addAddress(wallet._address)
      await list.addAddress(wallet3._address)
      await list.addAddress(wallet4._address)

      expect(await list.addressArray()).to.deep.equal([wallet4._address, wallet3._address, wallet._address, wallet2._address])

      await list.clearAll()

      expect(await list.contains(wallet._address)).to.be.false
      expect(await list.contains(wallet2._address)).to.be.false
      expect(await list.contains(wallet3._address)).to.be.false
      expect(await list.contains(wallet4._address)).to.be.false
    })

    it('should allow addresses to be added again', async () => {
      await list.addAddress(wallet._address)
      await list.addAddress(wallet4._address)

      expect(await list.addressArray()).to.deep.equal([wallet4._address, wallet._address, wallet2._address])

      await list.clearAll()

      expect(await list.addressArray()).to.deep.equal([])

      await list.addAddress(wallet3._address)

      expect(await list.addressArray()).to.deep.equal([wallet3._address])
    })
  })
});
