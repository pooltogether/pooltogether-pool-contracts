const { PoolEnv } = require('./support/PoolEnv')

describe('Withdraw Feature', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  describe('instantly', () => {
    it('should be free to withdraw instantly when pool has no previous prize', async () => {
      await env.createPool({ prizePeriodSeconds: 10 })
      await env.buyTickets({ user: 1, tickets: 100 })
      await env.withdrawInstantly({ user: 1, tickets: 100 })
      await env.expectUserToHaveTokens({ user: 1, tokens: 100 })
    })

    it('should allow a winner to withdraw instantly', async () => {
      await env.createPool({ prizePeriodSeconds: 10 })
      await env.buyTicketsAtTime({ user: 1, tickets: 100, elapsed: 0 })
      await env.poolAccrues({ tickets: 10 }) // 10% collateralized
      await env.awardPrize()
      await env.withdrawInstantly({ user: 1, tickets: 110 })
      await env.expectUserToHaveTokens({ user: 1, tokens: 110 })
    })
  
    it('should have a cost to withdraw if there is a previous prize', async () => {
      await env.createPool({ prizePeriodSeconds: 10 })
      // buy at time zero so that it is considered a 'full' ticket
      await env.buyTicketsAtTime({ user: 1, tickets: 100, elapsed: 0 })
      await env.poolAccrues({ tickets: 10 }) // 10% collateralized
      await env.awardPrize()
      // now we have a previous prize

      // buy tickets then withdraw immediately so that no credit was built
      await env.buyTickets({ user: 2, tickets: 100, elapsed: 0 })
      await env.withdrawInstantlyAtTime({ user: 2, tickets: 100, elapsed: 0 })

      // user should have paid 10% (same collateralization as last prize)
      await env.expectUserToHaveTokens({ user: 2, tokens: 90 })
    })

    it('should use a users credit', async () => {
      await env.createPool({ prizePeriodSeconds: 10 })
      // buy at half time, so the tickets are only as effective as 100 tickets
      await env.buyTicketsAtTime({ user: 1, tickets: 200, elapsed: 5 })
      await env.poolAccrues({ tickets: 10 })
      await env.awardPrize()
      // now we have a previous prize
      // previous prize collateralization = 10 / (200 * 5/10) = 0.1

      // buy tickets at time 0, then withdraw at time 5.
      await env.buyTickets({ user: 2, tickets: 100, elapsed: 0 })
      await env.poolAccrues({ tickets: 31 })
      // now the pool has accrued 31 tickets on 310- meaning user 2 should have credit of 10
      await env.expectUserToHaveCredit({ user: 2, credit: 10 })
      await env.withdrawInstantly({ user: 2, tickets: 100 })

      // consume the credit so they can now withdraw for free
      await env.expectUserToHaveTokens({ user: 2, tokens: 100 })
      await env.expectUserToHaveCredit({ user: 2, credit: 0 })
    })
  })

  describe('timelocked', () => {
    it('should have the maximum timelock when a users tickets are undercollateralized', async () => {
      await env.createPool({ prizePeriodSeconds: 10 })
      // buy at time zero so that it is considered a 'full' ticket
      await env.buyTicketsAtTime({ user: 1, tickets: 100, elapsed: 0 })
      await env.poolAccrues({ tickets: 10 }) // 10% collateralized
      await env.awardPrize()

      // buy tickets at time 0
      await env.buyTickets({ user: 2, tickets: 100, elapsed: 0 })
      // withdraw at time 0 (to make the end time easy to calculate)
      await env.withdrawWithTimelockAtTime({ user: 2, tickets: 100, elapsed: 0 })

      // tickets are converted to timelock
      await env.expectUserToHaveTimelock({ user: 2, timelock: 100 })
      await env.expectUserTimelockAvailableAt({ user: 2, elapsed: 10 })

      // sweep balances
      await env.sweepTimelockBalancesAtTime({ user: 2, elapsed: 10 })

      // expect balance
      await env.expectUserToHaveTokens({ user: 2, tokens: 100 })
    })

    it('should consume a users credit to shorten the timelock', async () => {
      await env.createPool({ prizePeriodSeconds: 10 })
      // buy at time zero so that it is considered a 'full' ticket
      await env.buyTicketsAtTime({ user: 1, tickets: 100, elapsed: 0 })
      await env.poolAccrues({ tickets: 10 }) // 10% collateralized
      await env.awardPrize()

      // buy tickets at time 0
      await env.buyTicketsAtTime({ user: 2, tickets: 100, elapsed: 0 })
      await env.expectUserToHaveTickets({ user: 2, tickets: 100 })

      // accrue 10.5 tickets for 210, which means the user has credit of 5
      await env.poolAccrues({ tickets: '10.5' })
      await env.expectUserToHaveCredit({ user: 2, credit: 5 })

      // withdraw with timelock.  Req'd cltralization is 0.1.  They already have 5, so half time.
      await env.withdrawWithTimelockAtTime({ user: 2, tickets: 100, elapsed: 0 })

      // should have burned their credit
      await env.expectUserToHaveCredit({ user: 2, credit: 0 })

      // tickets are converted to timelock
      await env.expectUserToHaveTimelock({ user: 2, timelock: 100 })
      await env.expectUserTimelockAvailableAt({ user: 2, elapsed: 5 })

      // sweep balances
      await env.sweepTimelockBalancesAtTime({ user: 2, elapsed: 10 })

      // expect balance
      await env.expectUserToHaveTokens({ user: 2, tokens: 100 })
    })
  })
})
