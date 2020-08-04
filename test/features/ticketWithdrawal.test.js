const { PoolEnv } = require('./support/PoolEnv')

describe('Withdraw Feature', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  describe('instantly', () => {
    it('should should charge the exit fee when the user has no credit', async () => {
      await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
      await env.buyTicketsAtTime({ user: 1, tickets: 100, elapsed: 5 })
      await env.withdrawInstantlyAtTime({ user: 1, tickets: 100, elapsed: 5 })
      await env.expectUserToHaveTokens({ user: 1, tokens: 90 })
      await env.expectUserToHaveCredit({ user: 1, credit: 0 })
    })

    it('should allow a winner to withdraw instantly', async () => {
      await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
      await env.buyTicketsAtTime({ user: 1, tickets: 100, elapsed: 0 })
      await env.poolAccrues({ tickets: 10 }) // 10% collateralized
      await env.awardPrize()
      await env.withdrawInstantlyAtTime({ user: 1, tickets: 110, elapsed: 0 })
      await env.expectUserToHaveTokens({ user: 1, tokens: 110 })
      // all of their credit was burned
      await env.expectUserToHaveCredit({ user: 1, credit: 0 })
    })

    it('should require the fees be paid before credit is consumed', async () => {
      await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
      await env.buyTicketsAtTime({ user: 1, tickets: 100, elapsed: 0 })
      await env.buyTicketsAtTime({ user: 1, tickets: 100, elapsed: 10 })
      await env.awardPrize()
      await env.withdrawInstantlyAtTime({ user: 1, tickets: 100, elapsed: 0 })
      // charge was taken from user
      await env.expectUserToHaveTokens({ user: 1, tokens: 90 })
      // user still has credit
      await env.expectUserToHaveCredit({ user: 1, credit: 10 })
    })

    describe('with very large amounts', () => {
      let largeAmount = '999999999999999999' // 999 quadrillion

      it('should calculate correct exit-fees at 10%', async () => {
        await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
        await env.buyTicketsAtTime({ user: 1, tickets: largeAmount, elapsed: 0 })
        await env.poolAccrues({ tickets: '99999999999999999.9' }) // 10% collateralized
        await env.awardPrize()
        await env.withdrawInstantlyAtTime({ user: 1, tickets: '1099999999999999998.9', elapsed: 0 })
        await env.expectUserToHaveTokens({ user: 1, tokens: '1099999999999999998.9' })
        // all of their credit was burned
        await env.expectUserToHaveCredit({ user: 1, credit: 0 })
      })

      it('should calculate correct exit-fees at 25%', async () => {
        await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.25', creditRate: '0.025' })
        await env.buyTicketsAtTime({ user: 1, tickets: largeAmount, elapsed: 0 })
        await env.poolAccrues({ tickets: '249999999999999999.75' }) // 25% collateralized
        await env.awardPrize()
        await env.withdrawInstantlyAtTime({ user: 1, tickets: '1249999999999999998.75', elapsed: 0 })
        await env.expectUserToHaveTokens({ user: 1, tokens: '1249999999999999998.75' })
        // all of their credit was burned
        await env.expectUserToHaveCredit({ user: 1, credit: 0 })
      })

      it('should calculate correct exit-fees at 37%', async () => {
        await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.37', creditRate: '0.037' })
        await env.buyTicketsAtTime({ user: 1, tickets: largeAmount, elapsed: 0 })
        await env.poolAccrues({ tickets: '369999999999999999.63' }) // 37% collateralized
        await env.awardPrize()
        await env.withdrawInstantlyAtTime({ user: 1, tickets: '1369999999999999998.63', elapsed: 0 })
        await env.expectUserToHaveTokens({ user: 1, tokens: '1369999999999999998.63' })
        // all of their credit was burned
        await env.expectUserToHaveCredit({ user: 1, credit: 0 })
      })

      it('should calculate correct exit-fees at 99%', async () => {
        await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.99', creditRate: '0.099' })
        await env.buyTicketsAtTime({ user: 1, tickets: largeAmount, elapsed: 0 })
        await env.poolAccrues({ tickets: '989999999999999999.01' }) // 99% collateralized
        await env.awardPrize()
        await env.withdrawInstantlyAtTime({ user: 1, tickets: '1989999999999999998.01', elapsed: 0 })
        await env.expectUserToHaveTokens({ user: 1, tokens: '1989999999999999998.01' })
        // all of their credit was burned
        await env.expectUserToHaveCredit({ user: 1, credit: 0 })
      })
    })
  })

  describe('timelocked', () => {
    it('should have the maximum timelock when the user has zero credit', async () => {
      await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
      // buy at time zero so that it is considered a 'full' ticket
      await env.buyTicketsAtTime({ user: 1, tickets: 100, elapsed: 0 })
      await env.withdrawWithTimelockAtTime({ user: 1, tickets: 100, elapsed: 0 })

      // tickets are converted to timelock
      await env.expectUserToHaveTimelock({ user: 1, timelock: 100 })
      await env.expectUserTimelockAvailableAt({ user: 1, elapsed: 10 })

      // sweep balances
      await env.sweepTimelockBalancesAtTime({ user: 1, elapsed: 10 })

      // expect balance
      await env.expectUserToHaveTokens({ user: 1, tokens: 100 })
    })

    it('should consume a users credit to shorten the timelock', async () => {
      await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })

      // buy at time zero so that it is considered a 'full' ticket
      await env.buyTicketsAtTime({ user: 1, tickets: 100, elapsed: 0 })

      // withdraw at half time so credit should have accrued
      await env.withdrawWithTimelockAtTime({ user: 1, tickets: 100, elapsed: 5 })

      // tickets are converted to timelock
      await env.expectUserToHaveTimelock({ user: 1, timelock: 100 })
      await env.expectUserTimelockAvailableAt({ user: 1, elapsed: 10 })

      // sweep balances
      await env.sweepTimelockBalancesAtTime({ user: 1, elapsed: 10 })

      // expect balance
      await env.expectUserToHaveTokens({ user: 1, tokens: 100 })

      await env.expectUserToHaveCredit({ user: 1, credit: 0 })
    })

    it('should not have any timelock when a user accrues all the credit', async () => {
      await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })

      // buy at time zero so that it is considered a 'full' ticket
      await env.buyTicketsAtTime({ user: 1, tickets: 100, elapsed: 0 })

      await env.expectUserToHaveCreditAtTime({ user: 1, credit: 10, elapsed: 10 })

      // withdraw with timelock should be immediate
      await env.withdrawWithTimelockAtTime({ user: 1, tickets: 100, elapsed: 17 })

      // tickets are converted to timelock
      await env.expectUserToHaveTimelock({ user: 1, timelock: 0 })

      // expect balance
      await env.expectUserToHaveTokens({ user: 1, tokens: 100 })
      await env.expectUserToHaveCredit({ user: 1, credit: 0 })
    })
  })
})
