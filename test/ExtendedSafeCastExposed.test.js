const { deployContract } = require('ethereum-waffle')
const ExtendedSafeCastExposed = require('../build/ExtendedSafeCastExposed.json')

const { ethers } = require('./helpers/ethers')
const { expect } = require('chai')
const buidler = require('./helpers/buidler')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:ExtendedSafeCastExposed.test')

let overrides = { gasLimit: 20000000 }

describe('ExtendedSafeCastExposed', function() {

  let cast

  const MAX = '5192296858534827628530496329220096' // 2**112

  beforeEach(async () => {
    [wallet, wallet2, wallet3, wallet4] = await buidler.ethers.getSigners()
    
    cast = await deployContract(wallet, ExtendedSafeCastExposed, [], overrides)
  })

  describe('toUint112()', () => {
    it('should safely cast smaller numbers', async () => {
      expect(await cast.toUint112('24')).to.equal('24')
    })

    it('should throw on overflow', async () => {
      await expect(cast.toUint112(MAX)).to.be.revertedWith("SafeCast: value doesn't fit in an uint112")
    })
  })

});
