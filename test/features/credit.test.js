const { PoolEnv } = require('./support/PoolEnv')

describe('Credit Feature', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should earn credit on held tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
    await env.setCurrentTime(0)
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.setCurrentTime(10)
    await env.expectUserToHaveCredit({ user: 1, credit: 10 }) // 10% credit
    // should not accrue more than exit fee
    await env.setCurrentTime(20)
    await env.expectUserToHaveCredit({ user: 1, credit: 10 }) // 10% credit
  })

  it('should receive credit when prize is won', async () => {
    await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
    await env.setCurrentTime(0)
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.setCurrentTime(20)
    await env.poolAccrues({ tickets: 100 }) // doesn't matter how much it accrues
    await env.awardPrize()
    await env.expectUserToHaveTickets({ user: 1, tickets: 200 })
    await env.expectUserToHaveCredit({ user: 1, credit: 20 }) // 10% credit on tickets plus prize credit
  })

  it('should have no credit after immediately buying tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
    await env.setCurrentTime(5)
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.expectUserToHaveCredit({ user: 1, credit: 0 }) // 10% credit
    await env.setCurrentTime(10)
    await env.expectUserToHaveCredit({ user: 1, credit: 5 }) // 10% credit over half a prize period
    // should not accrue more than exit fee
    await env.setCurrentTime(30)
    await env.expectUserToHaveCredit({ user: 1, credit: 10 }) // 10% credit
  })
})