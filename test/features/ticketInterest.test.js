const { PoolEnv } = require('./support/PoolEnv')

describe('Interest earned on Tickets', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should earn interest on held tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10 })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.poolAccrues({ tickets: 100 })
    await env.awardPrize()
    await env.expectUserToHaveTicketInterest({ user: 1, interest: 100 })
    await env.expectUserToHaveTickets({ user: 1, tickets: 200 })
  })

  it('should not earn interest for late comers to the pool', async () => {
    await env.createPool({ prizePeriodSeconds: 10 })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.poolAccrues({ tickets: 100 })
    await env.buyTickets({ user: 2, tickets: 100 })
    await env.awardPrizeToToken({ token: 1 })
    await env.expectUserToHaveTicketInterest({ user: 1, interest: 100 })
    await env.expectUserToHaveTicketInterest({ user: 2, interest: 0 })
  })


  it('should earn partial interest on tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10 })
    await env.buyTicketsAtTime({ user: 1, tickets: 100, elapsed: 0 })
    await env.poolAccrues({ tickets: 50 })
    await env.buyTicketsAtTime({ user: 2, tickets: 100, elapsed: 5 })
    await env.poolAccrues({ tickets: 50 })
    await env.awardPrizeToToken({ token: 1 })
    await env.expectUserToHaveTicketInterest({ user: 1, interest: 80 })
    await env.expectUserToHaveTicketInterest({ user: 2, interest: 20 })
  })

})