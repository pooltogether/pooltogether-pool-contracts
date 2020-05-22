const { expect } = require('chai')
const { deployContracts } = require('./helpers/deployContracts')
const buidler = require('./helpers/buidler')

const debug = require('debug')('ptv3:SingleRandomWinnerPrizePoolBuilder.test')

describe('SingleRandomWinnerPrizePoolBuilder contract', () => {

  let wallet

  let provider

  let env

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider
    env = await deployContracts(wallet)
  })

  describe('createSingleRandomWinnerPrizePool()', () => {
    it('should create a new prize pool', async () => {
      let tx = await env.singleRandomWinnerPrizePoolBuilder.createSingleRandomWinnerPrizePool(env.cToken.address, 10, 'Ticket', 'TICK', 'Sponsorship', 'SPON')

      let receipt = await provider.getTransactionReceipt(tx.hash)

      // @ts-ignore
      expect(receipt.logs.length).to.gt(2)
      
      // @ts-ignore
      let secondToLastLog = receipt.logs[receipt.logs.length - 2]
      // @ts-ignore
      let lastLog = receipt.logs[receipt.logs.length - 1]

      let prizePoolCreatedEvent = env.prizePoolBuilder.interface.events.PrizePoolCreated.decode(secondToLastLog.data, secondToLastLog.topics)
      let singleRandomWinnerCreatedEvent = env.singleRandomWinnerPrizePoolBuilder.interface.events.SingleRandomWinnerPrizePoolCreated.decode(lastLog.data, lastLog.topics)

      expect(singleRandomWinnerCreatedEvent.creator).to.equal(wallet._address)
      expect(singleRandomWinnerCreatedEvent.prizePool).to.equal(prizePoolCreatedEvent.prizePool)

      debug(`loading up CompoundYieldService...`)

      let yieldService = await buidler.ethers.getContractAt('CompoundYieldService', prizePoolCreatedEvent.yieldService, wallet)
      expect(await yieldService.token()).to.equal(env.token.address)

      debug(`loading up PeriodicPrizePool...`)

      let prizePool = await buidler.ethers.getContractAt('PeriodicPrizePool', prizePoolCreatedEvent.prizePool, wallet)
      expect(await prizePool.yieldService()).to.equal(yieldService.address)
    })
  })
})
