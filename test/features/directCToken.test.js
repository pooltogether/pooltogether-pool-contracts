const { PoolEnv } = require('./support/PoolEnv')

describe('cTokens transferred to prize pool feature', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should correctly award ctokens that were transferred to the prize pool', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.buyTickets({ user: 1, tickets: 6122 })
    await env.transferCompoundTokensToPrizePool({ user: 2, tokens: 100 })
    await env.expectPoolToHavePrize({ tickets: 100 })
    await env.awardPrize()
    await env.expectUserToHaveTickets({ user: 1, tickets: 6222 })
    await env.withdrawInstantly({ user: 1 })
  })
})
