const { deployContract } = require('ethereum-waffle')
const BalanceDripExposed = require('../build/BalanceDripExposed.json')

const { call } = require('./helpers/call')
const { ethers } = require('./helpers/ethers')
const { expect } = require('chai')
const buidler = require('./helpers/buidler')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:BalanceDripExposed.test')

let overrides = { gasLimit: 20000000 }

describe('BalanceDripExposed', function() {

  let dripExposed

  beforeEach(async () => {
    [wallet, wallet2, wallet3, wallet4] = await buidler.ethers.getSigners()
    
    dripExposed = await deployContract(wallet, BalanceDripExposed, [], overrides)

    // current block is one
    await dripExposed.initialize(toWei('0.1'), 1)
  })

  describe('drip()', () => {

    it('should not drip any tokens the first time it is called', async () => {
      await dripExposed.drip(
        wallet._address,
        toWei('100'), // user has 100 tokens
        toWei('100'), // total supply of tokens
        1 // current timestamp
      )

      expect(await dripExposed.balanceOf(wallet._address)).to.equal('0')
    })

    it('should start to drip tokens as it moves along', async () => {
      await dripExposed.drip(
        wallet._address,
        toWei('0'), // user has 100 tokens
        toWei('0'), // total supply of tokens
        1 // current timestamp
      )

      await dripExposed.drip(
        wallet._address,
        toWei('100'), // user has 100 tokens
        toWei('100'), // total supply of tokens
        2 // current timestamp
      )

      expect(await dripExposed.balanceOf(wallet._address)).to.equal(toWei('0.1'))
    })

    it('should max out when the limit is reached', async () => {
      await dripExposed.drip(
        wallet._address,
        toWei('0'), // user has 100 tokens
        toWei('0'), // total supply of tokens
        1 // current timestamp
      )

      await dripExposed.drip(
        wallet._address,
        toWei('100'), // user has 100 tokens
        toWei('100'), // total supply of tokens
        5 // current timestamp
      )

      expect(await dripExposed.balanceOf(wallet._address)).to.equal(toWei('0.4'))
    })

    it('should spread the drip across different users', async () => {
      await dripExposed.drip(
        wallet._address,
        toWei('0'), // user balance
        toWei('0'), // total supply of tokens
        1 // current timestamp
      )

      await dripExposed.drip(
        wallet2._address,
        toWei('40'), // user has 100 tokens
        toWei('100'), // total supply of tokens
        1 // current timestamp
      )

      await dripExposed.drip(
        wallet._address,
        toWei('20'), // user balance
        toWei('100'), // total supply of tokens
        2 // current timestamp
      )

      await dripExposed.drip(
        wallet2._address,
        toWei('40'), // user has 100 tokens
        toWei('100'), // total supply of tokens
        2 // current timestamp
      )

      expect(await dripExposed.balanceOf(wallet._address)).to.equal(toWei('0.02'))
      expect(await dripExposed.balanceOf(wallet2._address)).to.equal(toWei('0.04'))
    })

    it('should drip for a user who deposits then withdraws later', async () => {
      await dripExposed.drip(
        wallet._address,
        toWei('0'), // user balance
        toWei('0'), // total supply of tokens
        1 // current timestamp
      )

      await dripExposed.drip(
        wallet._address,
        toWei('40'), // user balance
        toWei('40'), // total supply of tokens
        5 // current timestamp
      )

      expect(await dripExposed.balanceOf(wallet._address)).to.equal(toWei('0.4'))
    })

    it('should not drip to a user who shows up halfway through', async () => {
      await dripExposed.drip(
        wallet._address,
        toWei('0'), // user balance
        toWei('0'), // total supply of tokens
        1 // current timestamp
      )
      await dripExposed.drip(
        wallet._address,
        toWei('40'), // user balance
        toWei('40'), // total supply of tokens
        2 // current timestamp
      )
      await dripExposed.drip(
        wallet._address,
        toWei('40'), // user balance
        toWei('40'), // total supply of tokens
        3 // current timestamp
      )

      await dripExposed.drip(
        wallet2._address,
        toWei('10'), // user has 100 tokens
        toWei('50'), // total supply of tokens
        4 // current timestamp
      )
      await dripExposed.drip(
        wallet2._address,
        toWei('10'), // user has 100 tokens
        toWei('50'), // total supply of tokens
        5 // current timestamp
      )

      expect(await dripExposed.balanceOf(wallet._address)).to.equal(toWei('0.2'))
      expect(await dripExposed.balanceOf(wallet2._address)).to.equal(toWei('0.02'))

      await dripExposed.drip(
        wallet._address,
        toWei('40'), // user balance
        toWei('50'), // total supply of tokens
        6 // current timestamp
      )

      // they missed 3 seconds at 40/50 tokens with a drip of 0.1 / block =  3 * 0.8 * 0.1
      expect(await dripExposed.balanceOf(wallet._address)).to.equal(toWei('0.44'))
    })
  })
});
