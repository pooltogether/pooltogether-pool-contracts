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

      expect(await builder.prizePoolModuleManagerFactory()).to.equal(env.ownableModuleManagerFactory.address)
      expect(await builder.governor()).to.equal(env.governor.address)
      expect(await builder.compoundYieldServiceFactory()).to.equal(env.yieldServiceFactory.address)
      expect(await builder.periodicPrizePoolFactory()).to.equal(env.prizePoolFactory.address)
      expect(await builder.ticketFactory()).to.equal(env.ticketFactory.address)
      expect(await builder.creditFactory()).to.equal(env.creditFactory.address)
      expect(await builder.timelockFactory()).to.equal(env.timelockFactory.address)
      expect(await builder.sponsorshipFactory()).to.equal(env.sponsorshipFactory.address)
      expect(await builder.interestTrackerFactory()).to.equal(env.interestTrackerFactory.address)
      expect(await builder.rng()).to.equal(env.rng.address)
      expect(await builder.trustedForwarder()).to.equal(env.forwarder.address)
    })
  })
})
