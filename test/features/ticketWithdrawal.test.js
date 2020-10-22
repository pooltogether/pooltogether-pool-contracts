const { PoolEnv } = require('./support/PoolEnv')

describe('Compound Withdraw Feature', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  describe('instantly', () => {
    it('should should charge the exit fee when the user has no credit', async () => {
      await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
      await env.setCurrentTime(5)
      await env.buyTickets({ user: 1, tickets: 100 })
      await env.withdrawInstantly({ user: 1, tickets: 100 })
      await env.expectUserToHaveTokens({ user: 1, tokens: 90 })
      await env.expectUserToHaveCredit({ user: 1, credit: 0 })
    })

    it('should allow a winner to withdraw instantly', async () => {
      await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
      await env.buyTickets({ user: 1, tickets: 100 })
      await env.poolAccrues({ tickets: 10 }) // 10% collateralized
      await env.awardPrize()
      await env.expectUserToHaveCredit({ user: 1, credit: 11 })
      await env.expectUserToHaveTickets({ user: 1, tickets: 110 })
      await env.withdrawInstantly({ user: 1, tickets: 110 })
      await env.expectUserToHaveTokens({ user: 1, tokens: 110 })
      // all of their credit was burned
      await env.expectUserToHaveCredit({ user: 1, credit: 0 })
    })

    it('should require the fees be paid before credit is consumed', async () => {
      await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
      await env.buyTickets({ user: 1, tickets: 100 })
      await env.setCurrentTime(10)
      await env.buyTickets({ user: 1, tickets: 100 })
      await env.awardPrize()
      await env.withdrawInstantly({ user: 1, tickets: 100 })
      // charge was taken from user
      await env.expectUserToHaveTokens({ user: 1, tokens: 90 })
      // user still has credit from first deposit
      await env.expectUserToHaveCredit({ user: 1, credit: 10 })
    })

    describe('with very large amounts', () => {
      let largeAmount = '999999999999999999' // 999 quadrillion

      it('should calculate correct exit-fees at 10%', async () => {
        await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
        await env.buyTickets({ user: 1, tickets: largeAmount })
        await env.poolAccrues({ tickets: '99999999999999999.9' }) // 10% collateralized
        await env.awardPrize()
        await env.withdrawInstantly({ user: 1, tickets: '1099999999999999998.9' })
        await env.expectUserToHaveTokens({ user: 1, tokens: '1099999999999999998.9' })
        // all of their credit was burned
        await env.expectUserToHaveCredit({ user: 1, credit: 0 })
      })

      it('should calculate correct exit-fees at 25%', async () => {
        await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.25', creditRate: '0.025' })
        await env.buyTickets({ user: 1, tickets: largeAmount })
        await env.poolAccrues({ tickets: '249999999999999999.75' }) // 25% collateralized
        await env.awardPrize()
        await env.withdrawInstantly({ user: 1, tickets: '1249999999999999998.75' })
        await env.expectUserToHaveTokens({ user: 1, tokens: '1249999999999999998.75' })
        // all of their credit was burned
        await env.expectUserToHaveCredit({ user: 1, credit: 0 })
      })

      it('should calculate correct exit-fees at 37%', async () => {
        await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.37', creditRate: '0.037' })
        await env.buyTickets({ user: 1, tickets: largeAmount })
        await env.poolAccrues({ tickets: '369999999999999999.63' }) // 37% collateralized
        await env.awardPrize()
        await env.withdrawInstantly({ user: 1, tickets: '1369999999999999998.63' })
        await env.expectUserToHaveTokens({ user: 1, tokens: '1369999999999999998.63' })
        // all of their credit was burned
        await env.expectUserToHaveCredit({ user: 1, credit: 0 })
      })

      it('should calculate correct exit-fees at 99%', async () => {
        await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.99', creditRate: '0.099' })
        await env.buyTickets({ user: 1, tickets: largeAmount })
        await env.poolAccrues({ tickets: '989999999999999999.01' }) // 99% collateralized
        await env.awardPrize()
        await env.withdrawInstantly({ user: 1, tickets: '1989999999999999998.01' })
        await env.expectUserToHaveTokens({ user: 1, tokens: '1989999999999999998.01' })
        // all of their credit was burned
        await env.expectUserToHaveCredit({ user: 1, credit: 0 })
      })
    })
  })

  describe('timelocked', () => {
    it('should have the maximum timelock when the user has zero credit', async () => {
      await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
      // buy at time zero so that it is considered a 'full' ticket
      await env.buyTickets({ user: 1, tickets: 100 })
      await env.withdrawWithTimelock({ user: 1, tickets: 100 })
      // tickets are converted to timelock
      await env.expectUserToHaveTimelock({ user: 1, timelock: 100 })
      await env.expectUserTimelockAvailableAt({ user: 1, elapsed: 10 })

      // sweep balances
      await env.setCurrentTime(10)
      await env.sweepTimelockBalances({ user: 1 })
      // expect balance
      await env.expectUserToHaveTokens({ user: 1, tokens: 100 })
    })

    it('should consume a users credit to shorten the timelock', async () => {
      await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })

      // buy at time zero so that it is considered a 'full' ticket
      await env.setCurrentTime(0)
      await env.buyTickets({ user: 1, tickets: 100 })

      // withdraw at half time so credit should have accrued
      await env.setCurrentTime(6)
      await env.withdrawWithTimelock({ user: 1, tickets: 100 })

      // tickets are converted to timelock
      await env.expectUserToHaveTimelock({ user: 1, timelock: 100 })
      await env.expectUserTimelockAvailableAt({ user: 1, elapsed: 10 })

      // sweep balances
      await env.setCurrentTime(10)
      await env.sweepTimelockBalances({ user: 1 })

      // expect balance
      await env.expectUserToHaveTokens({ user: 1, tokens: 100 })

      await env.expectUserToHaveCredit({ user: 1, credit: 0 })
    })

    it('should not have any timelock when a user accrues all the credit', async () => {
      await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })

      // buy at time zero so that it is considered a 'full' ticket
      await env.buyTickets({ user: 1, tickets: 100 })

      await env.setCurrentTime(10)
      await env.expectUserToHaveCredit({ user: 1, credit: 10 })

      // withdraw with timelock should be immediate
      await env.setCurrentTime(17)
      await env.withdrawWithTimelock({ user: 1, tickets: 100 })

      // tickets are converted to timelock
      await env.expectUserToHaveTimelock({ user: 1, timelock: 0 })

      // expect balance
      await env.expectUserToHaveTokens({ user: 1, tokens: 100 })
      await env.expectUserToHaveCredit({ user: 1, credit: 0 })
    })
  })
})
