const { PoolEnv } = require('./support/PoolEnv')

describe('Tickets Feature', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should be possible to purchase tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01', yVault: true })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.buyTickets({ user: 2, tickets: 50 })
    await env.expectUserToHaveTickets({ user: 1, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 2, tickets: 50 })
  })

  it('should be possible to win tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01', yVault: true })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 1, tickets: 100 })
    await env.poolAccrues({ tickets: 100 })
    await env.awardPrizeToToken({ token: 0 })
    await env.expectUserToHaveTickets({ user: 1, tickets: 190 })
  })

  it('should account for reserve fees when awarding prizes', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01', yVault: true })
    await env.setReserveRate({ rate: '0.01' })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 1, tickets: 100 })
    await env.poolAccrues({ tickets: 100 })
    await env.awardPrize()
    await env.expectUserToHaveTickets({ user: 1, tickets: '189.1' })
  })

})