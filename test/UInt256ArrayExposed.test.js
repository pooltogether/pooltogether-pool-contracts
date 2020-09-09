const { deployContract } = require('ethereum-waffle')
const UInt256ArrayExposed = require('../build/UInt256ArrayExposed.json')

const { ethers } = require('ethers')
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')

const debug = require('debug')('ptv3:UInt256ArrayExposed.test')

let overrides = { gasLimit: 20000000 }

describe('UInt256ArrayExposed', function() {

  let array

  beforeEach(async () => {
    [wallet, wallet2, wallet3, wallet4] = await buidler.ethers.getSigners()    
  })

  describe('remove()', () => {
    it('should error when index is out of range', async () => {
      array = await deployContract(wallet, UInt256ArrayExposed, [[1, 2, 3, 4]], overrides)

      await expect(array.remove(5)).to.be.revertedWith("UInt256Array/unknown-index")
    })

    it('should work', async () => {
      array = await deployContract(wallet, UInt256ArrayExposed, [[1, 2, 3, 4]], overrides)

      await array.remove(2)

      expect((await array.toArray()).map(s => s.toString())).to.deep.equal(['1', '2', '4'])
    })
  })

});
