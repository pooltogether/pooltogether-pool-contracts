const { PoolEnv } = require('./support/PoolEnv')

describe('Re-deposit Timelocked Tokens', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  describe('convert timelock to tickets', () => {
    it('should allow the user to re-deposit timelock as tickets', async () => {
      await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
      // buy at time zero so that it is considered a 'full' ticket
      await env.setCurrentTime(0)
      await env.buyTickets({ user: 1, tickets: 100 })
      await env.withdrawWithTimelock({ user: 1, tickets: 100 })

      // tickets are converted to timelock
      await env.setCurrentTime(10)
      await env.expectUserToHaveTimelock({ user: 1, timelock: 100 })
      await env.expectUserTimelockAvailableAt({ user: 1, elapsed: 10 })

      await env.timelockBuyTickets({ user: 1, tickets: 100 })

      // expect balance
      await env.expectUserToHaveTickets({ user: 1, tickets: 100 })
      await env.expectUserToHaveTimelock({ user: 1, timelock: 0 })
    })
  })

  describe('convert timelock to sponsorship', () => {
    it('should allow the user to re-deposit timelock as tickets', async () => {
      await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
      // buy at time zero so that it is considered a 'full' ticket
      await env.setCurrentTime(0)
      await env.buyTickets({ user: 1, tickets: 100 })
      await env.withdrawWithTimelock({ user: 1, tickets: 100 })

      // tickets are converted to timelock
      await env.setCurrentTime(10)
      await env.expectUserToHaveTimelock({ user: 1, timelock: 100 })
      await env.expectUserTimelockAvailableAt({ user: 1, elapsed: 10 })

      await env.timelockBuySponsorship({ user: 1, sponsorship: 100 })

      // expect balance
      await env.expectUserToHaveSponsorship({ user: 1, sponsorship: 100 })
      await env.expectUserToHaveTimelock({ user: 1, timelock: 0 })
    })
  })
})
