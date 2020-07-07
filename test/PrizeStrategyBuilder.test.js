const { deployContracts } = require('../js/deployContracts')
const { expect } = require('chai')
const buidler = require('./helpers/buidler')

describe('PrizeStrategyBuilder', () => {
  
  let wallet

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()
  })

  describe('initialize()', () => {
    it('should setup all factories', async () => {
      let env = await deployContracts(wallet)

      let builder = env.prizeStrategyBuilder

      expect(await builder.governor()).to.equal(env.governor.address)
      expect(await builder.prizeStrategyProxyFactory()).to.equal(env.prizeStrategyProxyFactory.address)
      expect(await builder.trustedForwarder()).to.equal(env.forwarder.address)
      expect(await builder.compoundPrizePoolBuilder()).to.equal(env.compoundPrizePoolBuilder.address)
      expect(await builder.rng()).to.equal(env.rng.address)
    })
  })
})
