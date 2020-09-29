const { PoolEnv } = require('./support/PoolEnv')

describe('Tickets Feature', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should be possible to purchase tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.buyTickets({ user: 2, tickets: 50 })
    await env.expectUserToHaveTickets({ user: 1, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 2, tickets: 50 })
  })

  it('should be possible to win tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 1, tickets: 100 })
    await env.poolAccrues({ tickets: 100 })
    await env.awardPrizeToToken({ token: 0 })
    await env.expectUserToHaveTickets({ user: 1, tickets: 200 })
  })

  it('should account for reserve fees when awarding prizes', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.setReserveRate({ rate: '0.01' })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.poolAccrues({ tickets: 100 })
    await env.awardPrize()
    await env.expectUserToHaveTickets({ user: 1, tickets: 199 })
  })

  it('should not be possible to buy or transfer tickets during award', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.buyTickets({ user: 2, tickets: 100 })
    await env.startAward()

    await env.expectRevertWith(env.buyTickets({ user: 1, tickets: 100 }), "PeriodicPrizeStrategy/rng-in-flight")

    await env.expectRevertWith(env.transferTickets({ user: 2, tickets: 100, to: 3 }), "PeriodicPrizeStrategy/rng-in-flight")

    await env.completeAward({ token: 0 })

    await env.buyTickets({ user: 1, tickets: 100 })
    await env.transferTickets({ user: 2, tickets: 100, to: 3 })
  })

})