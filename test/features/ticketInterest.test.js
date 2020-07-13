const { PoolEnv } = require('./support/PoolEnv')

describe('Ticket Interest Feature', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should earn interest on held tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10 })
    await env.buyTicketsAtTime({ user: 1, tickets: 100, elapsed: 0 })
    await env.poolAccrues({ tickets: 100 })
    await env.awardPrize()
    await env.expectUserToHaveTickets({ user: 1, tickets: 200 })
    await env.expectUserToHaveCredit({ user: 1, credit: 200 })
  })

  it('should not earn interest for late comers to the pool', async () => {
    await env.createPool({ prizePeriodSeconds: 10 })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.poolAccrues({ tickets: 100 })
    await env.buyTickets({ user: 2, tickets: 100 })
    await env.awardPrizeToToken({ token: 1 })
    await env.expectUserToHaveCredit({ user: 2, credit: 0 })
  })

  it('should earn partial interest on tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10 })
    await env.buyTickets({ user: 1, tickets: 100 })
    // records index at 1

    await env.poolAccrues({ tickets: 50 })

    await env.buyTickets({ user: 2, tickets: 100 })
    // 50 has accrued on 100, so index is

    await env.poolAccrues({ tickets: 50 })
    // 50 accrues on 250.  However, we know that there are 200 tokens.

    // await env.awardPrizeToToken({ token: 1 })




    // given that the user began with a rate of 1, we expect (endRate - startRate) * tokens = 80) => (endRate * 100 - 1 * 100 = 80) => endRate * 100 = 80 + 100 = endRate = 1.8
    await env.expectUserToHaveCredit({ user: 1, credit: 80 })

    // given that the user began with a rate of 1.5, we expect (end rate - start rate * tokens = 20) => (endRate - 1.5 * 100 = 20) => endRate = 1.7
    await env.expectUserToHaveCredit({ user: 2, credit: 20 }) // user 1 should have 150/250 of 50, and user 2 has 100/250 of 50
  })

})