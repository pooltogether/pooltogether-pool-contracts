const { deployContract } = require('ethereum-waffle')
const BalanceDripExposed = require('../build/BalanceDripExposed.json')

const { call } = require('./helpers/call')
const { ethers } = require('ethers')
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:BalanceDripExposed.test')

let overrides = { gasLimit: 20000000 }

describe('BalanceDripExposed', function() {

  let dripExposed

  beforeEach(async () => {
    [wallet, wallet2, wallet3, wallet4] = await buidler.ethers.getSigners()
    
    dripExposed = await deployContract(wallet, BalanceDripExposed, [], overrides)

    // current block is one
    await dripExposed.setDripRate(toWei('0'), toWei('0.1'), 1)
  })

  describe('drip()', () => {

    it('should do nothing when run twice', async () => {
      await dripExposed.drip(
        wallet._address,
        toWei('0'), // user has 0 tokens
        toWei('0'), // total supply of tokens
        1 // current timestamp
      )

      await expect(
        dripExposed.dripTwice(
          wallet._address,
          toWei('100'), // user has 100 tokens
          toWei('100'), // total supply of tokens
          2 // current timestamp
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet._address, toWei('0.1'))
    })

    it('should not drip any tokens the first time it is called', async () => {
      await expect(
        dripExposed.drip(
          wallet._address,
          toWei('100'), // user has 100 tokens
          toWei('100'), // total supply of tokens
          1 // current timestamp
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet._address, '0')
    })

    it('should start to drip tokens as it moves along', async () => {
      await dripExposed.drip(
        wallet._address,
        toWei('0'), // user has 100 tokens
        toWei('0'), // total supply of tokens
        1 // current timestamp
      )

      await expect(
        dripExposed.drip(
          wallet._address,
          toWei('100'), // user has 100 tokens
          toWei('100'), // total supply of tokens
          2 // current timestamp
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet._address, toWei('0.1'))
    })

    it('should max out when the limit is reached', async () => {
      await dripExposed.drip(
        wallet._address,
        toWei('0'), // user has 100 tokens
        toWei('0'), // total supply of tokens
        1 // current timestamp
      )

      await expect(
        dripExposed.drip(
          wallet._address,
          toWei('100'), // user has 100 tokens
          toWei('100'), // total supply of tokens
          5 // current timestamp
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet._address, toWei('0.4'))
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

      await expect(
        dripExposed.drip(
          wallet._address,
          toWei('20'), // user balance
          toWei('100'), // total supply of tokens
          2 // current timestamp
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet._address, toWei('0.02'))

      await expect(
        dripExposed.drip(
          wallet2._address,
          toWei('40'), // user has 40 tokens
          toWei('100'), // total supply of tokens
          2 // current timestamp
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet2._address, toWei('0.04'))
    })

    it('should not drip to a user who shows up halfway through', async () => {
      await dripExposed.drip(
        wallet._address,
        toWei('0'), // user balance
        toWei('0'), // total supply of tokens
        1 // current timestamp
      )

      await expect(
        dripExposed.drip(
          wallet._address,
          toWei('40'), // user balance
          toWei('40'), // total supply of tokens
          2 // current timestamp
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet._address, toWei('0.1'))

      await expect(
        dripExposed.drip(
          wallet._address,
          toWei('40'), // user balance
          toWei('40'), // total supply of tokens
          3 // current timestamp
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet._address, toWei('0.1'))

      await expect(
        dripExposed.drip(
          wallet2._address,
          toWei('10'), // user has 100 tokens
          toWei('50'), // total supply of tokens
          4 // current timestamp
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet2._address, toWei('0'))

      await expect(
        dripExposed.drip(
          wallet2._address,
          toWei('10'), // user has 100 tokens
          toWei('50'), // total supply of tokens
          5 // current timestamp
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet2._address, toWei('0.02'))

      await expect(
        dripExposed.drip(
          wallet._address,
          toWei('40'), // user balance
          toWei('50'), // total supply of tokens
          6 // current timestamp
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet._address, toWei('0.24')) // 3 seconds @ 0.08 per second
    })
  })

  describe('setDripRate()', () => {

    it('should allow the drip rate to be changed on the fly', async () => {
      await dripExposed.setDripRate(toWei('0'), toWei('0.1'), 1)

      await expect(
        dripExposed.drip(
          wallet._address,
          toWei('40'), // user balance
          toWei('40'), // total supply of tokens
          3 // current timestamp
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet._address, toWei('0'))

      await expect(
        dripExposed.drip(
          wallet._address,
          toWei('40'), // user balance
          toWei('40'), // total supply of tokens
          4 // current timestamp
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet._address, toWei('0.1'))

      // double the drip rate 2 seconds after the previous update
      await dripExposed.setDripRate(
        toWei('40'),
        toWei('0.2'),
        6
      )

      // next drip should include the two seconds @ 0.1 and 1 second @ 0.2 = 0.4
      await expect(
        dripExposed.drip(
          wallet._address,
          toWei('40'), // user balance
          toWei('40'), // total supply of tokens
          7 // current timestamp
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet._address, toWei('0.4'))

      // zero out the drip rate
      await dripExposed.setDripRate(
        toWei('40'),
        toWei('0'),
        8
      )

      // ten seconds later increase the rate
      await dripExposed.setDripRate(
        toWei('40'),
        toWei('0.3'),
        18
      )

      // next drip should include one second @ 0.2 and 2 seconds @ 0.3 = 0.8
      await expect(
        dripExposed.drip(
          wallet._address,
          toWei('40'), // user balance
          toWei('40'), // total supply of tokens
          20 // current timestamp
        )
      )
        .to.emit(dripExposed, 'Dripped')
        .withArgs(wallet._address, toWei('0.8'))
    })
  })
});
