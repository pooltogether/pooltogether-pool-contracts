const { deployContract } = require('ethereum-waffle')
const RelayRecipient = require('../build/RelayRecipient.json')

const { expect } = require('chai')
const buidler = require('./helpers/buidler')
const { AddressZero } = require('ethers/constants')

const debug = require('debug')('ptv3:RelayRecipient.test')

let overrides = { gasLimit: 20000000 }

describe('RelayRecipient', function() {

  let relay

  beforeEach(async () => {
    [wallet, wallet2, wallet3, wallet4] = await buidler.ethers.getSigners()
    
    relay = await deployContract(wallet, RelayRecipient, [], overrides)
  })

  describe('versionRecipient()', () => {
    it('should return the string', async () => {
      expect(await relay.versionRecipient()).to.equal("2.0.0-beta.1+pooltogether.relay.recipient")
    })
  })
  
  describe('getTrustedForwarder()', () => {
    it('should default to zero', async () => {
      expect(await relay.getTrustedForwarder()).to.equal(AddressZero)
    })
  })

});
