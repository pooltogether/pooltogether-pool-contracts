const { deployContracts } = require('../js/deployContracts')
const { expect } = require('chai')
const buidler = require('./helpers/buidler')

describe('PrizePoolBuilder', () => {
  
  let wallet

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()
  })

  describe('initialize()', () => {
    it('should setup all factories', async () => {
      let env = await deployContracts(wallet)

      let builder = env.prizePoolBuilder

      expect(await builder.governor()).to.equal(env.governor.address)
      expect(await builder.periodicPrizePoolFactory()).to.equal(env.prizePoolFactory.address)
      expect(await builder.ticketFactory()).to.equal(env.ticketFactory.address)
      expect(await builder.controlledTokenFactory()).to.equal(env.controlledTokenFactory.address)
      expect(await builder.trustedForwarder()).to.equal(env.forwarder.address)
    })
  })
})
