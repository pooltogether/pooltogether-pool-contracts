const { PoolEnv } = require('./support/PoolEnv')

describe('Credit Feature', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should earn credit on held tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01', externalAwards: ['COMP'] })
    await env.accrueExternalAwardAmount({ externalAward: 'COMP', amount: '1' })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.awardPrize()
    await env.expectUserToHaveExternalAwardAmount({ user: 1, externalAward: 'COMP', amount: '1' })
  })

})