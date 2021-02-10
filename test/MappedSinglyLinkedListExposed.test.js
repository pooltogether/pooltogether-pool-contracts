const { ethers } = require('ethers')
const { expect } = require('chai')
const hardhat = require('hardhat')
const { AddressZero } = require('ethers').constants

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:MappedSinglyLinkedListExposed.test')

let overrides = { gasLimit: 9500000 }

const SENTINEL = '0x0000000000000000000000000000000000000001'

describe('MappedSinglyLinkedListExposed', function() {

  let list

  beforeEach(async () => {
    [wallet, wallet2, wallet3, wallet4] = await hardhat.ethers.getSigners()
    const MappedSinglyLinkedListExposed = await hre.ethers.getContractFactory("MappedSinglyLinkedListExposed", wallet, overrides)
   
    list = await MappedSinglyLinkedListExposed.deploy()

    await list.initialize()
    await list.addAddresses([wallet2.address])
  })

  describe('initialize()', () => {
    it('should have initialized with a value', async () => {
      expect(await list.contains(wallet2.address)).to.be.true
    })

    it('should not be initialized after it contains values', async () => {
      await expect(list.initialize()).to.be.revertedWith('Already init')
    })
  })

  describe('addressArray', () =>{
    it('should create an array from addresses', async () => {
      expect(await list.addressArray()).to.deep.equal([wallet2.address])
    })
  })

  describe('addAddress', () => {
    it('should not allow adding the SENTINEL address', async () => {
      await expect(list.addAddress(SENTINEL)).to.be.revertedWith("Invalid address")
    })

    it('should not allow adding a zero address', async () => {
      await expect(list.addAddress(AddressZero)).to.be.revertedWith("Invalid address")
    })

    it('should allow the user to add an address', async () => {
      await list.addAddress(wallet.address)

      expect(await list.addressArray()).to.deep.equal([wallet.address, wallet2.address])
    })
  })

  describe('removeAddress', () => {
    it('should not allow removing the SENTINEL address', async () => {
      await expect(list.removeAddress(SENTINEL, SENTINEL)).to.be.revertedWith("Invalid address")
    })

    it('should not allow removing an address that does not exist', async () => {
      await expect(list.removeAddress(wallet.address, wallet2.address)).to.be.revertedWith("Invalid prevAddress")
    })

    it('should not allow removing a zero address', async () => {
      await expect(list.removeAddress(wallet.address, AddressZero)).to.be.revertedWith("Invalid address")
    })

    it('should allow the user to add an address', async () => {
      await list.addAddress(wallet.address)

      await list.removeAddress(wallet.address, wallet2.address)

      expect(await list.addressArray()).to.deep.equal([wallet.address])
      expect(await list.contains(wallet2.address)).to.be.false
    })
  })

  describe('contains()', () => {
    it('should return false for sentinel', async () => {
      expect(await list.contains(SENTINEL)).to.be.false
    })

    it('should return false for the zero address', async () => {
      expect(await list.contains(AddressZero)).to.be.false
    })
  })

  describe('clearAll', () =>{
    it('should clear the list', async () => {
      await list.addAddress(wallet.address)
      await list.addAddress(wallet3.address)
      await list.addAddress(wallet4.address)

      expect(await list.addressArray()).to.deep.equal([wallet4.address, wallet3.address, wallet.address, wallet2.address])

      await list.clearAll()

      expect(await list.contains(wallet.address)).to.be.false
      expect(await list.contains(wallet2.address)).to.be.false
      expect(await list.contains(wallet3.address)).to.be.false
      expect(await list.contains(wallet4.address)).to.be.false
    })

    it('should allow addresses to be added again', async () => {
      await list.addAddress(wallet.address)
      await list.addAddress(wallet4.address)

      expect(await list.addressArray()).to.deep.equal([wallet4.address, wallet.address, wallet2.address])

      await list.clearAll()

      expect(await list.addressArray()).to.deep.equal([])

      await list.addAddress(wallet3.address)

      expect(await list.addressArray()).to.deep.equal([wallet3.address])
    })
  })
});
