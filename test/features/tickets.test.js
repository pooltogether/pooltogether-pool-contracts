const { PoolEnv } = require('./support/PoolEnv')

describe('Tickets', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  describe('Purchase tickets', () => {
    it('should be possible to purchase tickets', async () => {
      await env.createPool({ prizePeriodSeconds: 10 })
      await env.buyTickets({ user: 1, tickets: 100 })
      await env.buyTickets({ user: 2, tickets: 50 })
      await env.expectUserToHaveTickets({ user: 1, tickets: 100 })
      await env.expectUserToHaveTickets({ user: 2, tickets: 50 })
    })
  
    it('should be possible to win tickets', async () => {
      await env.createPool({ prizePeriodSeconds: 10 })
      await env.buyTickets({ user: 1, tickets: 100 })
      await env.poolAccrues({ tickets: 100 })
      await env.awardPrizeToToken({ token: 0 })
      await env.expectUserToHaveTickets({ user: 1, tickets: 200 })
    })
  })

  describe('redeem tickets instantly', () => {

    it('is free when there was no previous prize', async () => {
      await env.createPool({ prizePeriodSeconds: 10 })
      await env.buyTickets({ user: 1, tickets: 100 })
      await env.redeemTicketsInstantly({ user: 1, tickets: 100 })
      await env.expectUserToHaveTokens({ user: 1, tokens: 100 })
    })

    it('is free when the user has contributed their share of interest', async () => {
      await env.createPool({ prizePeriodSeconds: 100 })
      await env.buyTicketsAtTime({ user: 1, tickets: 100, time: 0 })
      await env.buyTicketsAtTime({ user: 2, tickets: 100, time: 0 })
      await env.poolAccrues({ tickets: 10 })
      await env.awardPrizeToToken({ token: 0 })
      await env.redeemTicketsInstantlyAtTime({ user: 2, tickets: 100, time: 0 })
      await env.expectUserToHaveTokens({ user: 2, tokens: 100 })
    })

    it('should have the maximum exit fee when they enter and exit immediately', async () => {
      await env.createPool({ prizePeriodSeconds: 100 })
      await env.buyTicketsAtTime({ user: 1, tickets: 100, time: 0 })
      await env.poolAccrues({ tickets: 10 })
      await env.buyTicketsAtTime({ user: 2, tickets: 100, time: 100 })
      await env.awardPrizeToToken({ token: 1 })
      await env.expectUserToHaveTickets({ user: 2, tickets: 100 })
      await env.redeemTicketsInstantlyAtTime({ user: 2, tickets: 100, time: 0 })
      await env.expectUserToHaveTokens({ user: 2, tokens: 90 })
    })

  })

  describe('redeem tickets with timelock', () => {

    it('timelock redemption is instant when there was no previous prize', async () => {
      await env.createPool({ prizePeriodSeconds: 100 })
      await env.buyTickets({ user: 1, tickets: 100 })
      await env.expectUserToHaveTokens({ user: 1, tokens: 0 })
      await env.redeemTicketsWithTimelock({ user: 1, tickets: 100 })
      await env.expectUserToHaveTokens({ user: 1, tokens: 100 })
    })

  })
  

})