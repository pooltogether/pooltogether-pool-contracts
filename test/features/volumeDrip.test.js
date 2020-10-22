const { PoolEnv } = require('./support/PoolEnv')

const debug = require('debug')('ptv3:volumeDrip.test')

describe('Volume drip', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should drip users governance tokens', async () => {
    await env.createPool({ prizePeriodStart: 0, prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, endTime: 40 })
    await env.buyTickets({ user: 1, tickets: '5' })
    await env.buyTickets({ user: 1, tickets: '5' })
    await env.buyTickets({ user: 1, tickets: '5' })
    await env.buyTickets({ user: 1, tickets: '5' })
    await env.setCurrentTime(40)
    await env.buyTickets({ user: 1, tickets: '10' })
    await env.claimGovernanceDripTokens({ user: 1 })
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '100' })
  })

  it('should accrue over multiple periods', async () => {
    await env.createPool({ prizePeriodStart: 0, prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, endTime: 10 })
    await env.setCurrentTime(6)
    await env.buyTickets({ user: 1, tickets: '10' })
    await env.setCurrentTime(15)
    await env.buyTickets({ user: 1, tickets: '10' })

    // now we're the next volume period, so we accrue
    await env.setCurrentTime(21)
    await env.claimGovernanceDripTokens({ user: 1 })
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '200' })
  })

  it('should allow users to claim multiple times', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, endTime: 10 })

    await env.setCurrentTime(5)
    await env.buyTickets({ user: 1, tickets: '10' })
    await env.setCurrentTime(15)
    await env.claimGovernanceDripTokens({ user: 1 })
    await env.buyTickets({ user: 1, tickets: '10' })
    await env.setCurrentTime(25)
    await env.claimGovernanceDripTokens({ user: 1 })

    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '200' })
  })

  it("should split the volume between users", async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.setCurrentTime(0)
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, endTime: 30 })
    await env.setCurrentTime(30)
    await env.buyTickets({ user: 1, tickets: '10' })
    await env.buyTickets({ user: 2, tickets: '30' })
    await env.setCurrentTime(40)
    await env.claimGovernanceDripTokens({ user: 1 })
    await env.setCurrentTime(60)
    await env.claimGovernanceDripTokens({ user: 2, index: 1 })
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '25' })
    await env.expectUserToHaveGovernanceTokens({ user: 2, tokens: '75' })
  })

  it('should deactivate the drip when all tokens have been distributed', async () => {
    await env.createPool({ prizePeriodStart: 0, prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, endTime: 40 })
    // reduce drip-token balance to 100
    await env.burnGovernanceTokensFromComptroller({ amount: '9900' })
    // user 1 will get all of the available drip tokens
    await env.buyTickets({ user: 1, tickets: '100' })
    await env.setCurrentTime(40)
    await env.claimGovernanceDripTokens({ user: 1 })
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '100' })
    // user 2 will not receive any drip tokens after deactivation
    await env.buyTickets({ user: 2, tickets: '100' })
    await env.setCurrentTime(80)
    await env.claimGovernanceDripTokens({ user: 2 })
    await env.expectUserToHaveGovernanceTokens({ user: 2, tokens: '0' })
    // user 1 will still have only 100
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '100' })
  })
})
