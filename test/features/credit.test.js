const { PoolEnv } = require('./support/PoolEnv')

describe('Credit Feature', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should earn credit on held tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
    await env.buyTicketsAtTime({ user: 1, tickets: 100, elapsed: 0 })
    await env.expectUserToHaveCreditAtTime({ user: 1, credit: 10, elapsed: 10 }) // 10% credit
    // should not accrue more than exit fee
    await env.expectUserToHaveCreditAtTime({ user: 1, credit: 10, elapsed: 20 }) // 10% credit
  })

  it('should receive credit when prize is won', async () => {
    await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
    await env.buyTicketsAtTime({ user: 1, tickets: 100, elapsed: 0 })
    await env.poolAccrues({ tickets: 100 }) // doesn't matter how much it accrues
    await env.awardPrize()
    await env.expectUserToHaveTickets({ user: 1, tickets: 200 })
    await env.expectUserToHaveCreditAtTime({ user: 1, credit: 20, elapsed: 20 }) // 10% credit on tickets plus prize credit
  })

  it('should have no credit after immediately buying tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
    await env.buyTicketsAtTime({ user: 1, tickets: 100, elapsed: 5 })
    await env.expectUserToHaveCreditAtTime({ user: 1, credit: 0, elapsed: 5 }) // 10% credit
    await env.expectUserToHaveCreditAtTime({ user: 1, credit: 5, elapsed: 10 }) // 10% credit over half a prize period
    // should not accrue more than exit fee
    await env.expectUserToHaveCreditAtTime({ user: 1, credit: 10, elapsed: 30 }) // 10% credit
  })
})