const { PoolEnv } = require('./support/PoolEnv')

describe('Credit Feature', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should earn credit on held tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.setCurrentTime(11)
    await env.expectUserToHaveCredit({ user: 1, credit: 10 }) // 10% credit
    // should not accrue more than exit fee
    await env.setCurrentTime(21)
    await env.expectUserToHaveCredit({ user: 1, credit: 10 }) // 10% credit
  })

  it('should receive credit when prize is won', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.setCurrentTime(21)
    await env.poolAccrues({ tickets: 100 }) // doesn't matter how much it accrues
    await env.awardPrize()
    await env.expectUserToHaveTickets({ user: 1, tickets: 200 })
    await env.expectUserToHaveCredit({ user: 1, credit: 20 }) // 10% credit on tickets plus prize credit
  })

  it('should have no credit after immediately buying tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.setCurrentTime(6)
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.expectUserToHaveCredit({ user: 1, credit: 0 }) // 10% credit
    await env.setCurrentTime(11)
    await env.expectUserToHaveCredit({ user: 1, credit: 5 }) // 10% credit over half a prize period
    // should not accrue more than exit fee
    await env.setCurrentTime(31)
    await env.expectUserToHaveCredit({ user: 1, credit: 10 }) // 10% credit
  })

  it('should limit a users credit when they transfer tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.setCurrentTime(10)
    // user 1 has full credit
    await env.expectUserToHaveCredit({ user: 1, credit: 10 })
    await env.transferTickets({ user: 1, tickets: 50, to: 2 })
    // user 1 credit is limited now to *half*
    await env.expectUserToHaveCredit({ user: 1, credit: 5 })
    await env.expectUserToHaveCredit({ user: 2, credit: 0 })
  })

  it('should no longer accrue credit after a full transfer', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.setCurrentTime(10)
    await env.transferTickets({ user: 1, tickets: 100, to: 2 })
    await env.expectUserToHaveCredit({ user: 1, credit: 0 })
    await env.setCurrentTime(20)
    await env.expectUserToHaveCredit({ user: 2, credit: 10 })
  })
})
