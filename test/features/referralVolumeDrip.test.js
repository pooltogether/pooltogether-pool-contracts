const { PoolEnv } = require('./support/PoolEnv')
const ethers = require('ethers')

describe('Referral volume drip', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should drip users governance tokens', async () => {
    await env.createPool({ prizePeriodStart: 0, prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, endTime: 40, isReferral: true })
    await env.buyTickets({ user: 1, tickets: '10', referrer: 2 })
    await env.buyTickets({ user: 1, tickets: '10', referrer: 2 })
    await env.buyTickets({ user: 1, tickets: '10', referrer: 2 })
    await env.setCurrentTime(40)
    await env.buyTickets({ user: 1, tickets: '10', referrer: 2 })
    await env.claimGovernanceDripTokens({ user: 2 })
    await env.expectUserToHaveGovernanceTokens({ user: 2, tokens: '100' })
  })

  it("should split the volume between users", async () => {
    await env.createPool({ prizePeriodStart: 0, prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.setCurrentTime(0)
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, endTime: 40, isReferral: true })
    await env.setCurrentTime(30)
    await env.buyTickets({ user: 1, tickets: '10', referrer: 3 })
    await env.buyTickets({ user: 2, tickets: '30', referrer: 4 })
    await env.setCurrentTime(40)
    await env.claimGovernanceDripTokens({ user: 3 })
    await env.setCurrentTime(60)
    await env.claimGovernanceDripTokens({ user: 4, index: 1 })
    await env.expectUserToHaveGovernanceTokens({ user: 3, tokens: '25' })
    await env.expectUserToHaveGovernanceTokens({ user: 4, tokens: '75' })
  })

  it('should deactivate the drip when all tokens have been distributed', async () => {
    await env.createPool({ prizePeriodStart: 0, prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, endTime: 40, isReferral: true })
    // reduce drip-token balance to 100
    await env.burnGovernanceTokensFromComptroller({ amount: '9900' })
    // user 3 will get all of the available referral drip tokens
    await env.buyTickets({ user: 1, tickets: '100', referrer: 3 })
    await env.setCurrentTime(40)
    await env.claimGovernanceDripTokens({ user: 3 })
    await env.expectUserToHaveGovernanceTokens({ user: 3, tokens: '100' })
    // user 4 will not receive any referral drip tokens after deactivation
    await env.buyTickets({ user: 2, tickets: '100', referrer: 4 })
    await env.setCurrentTime(80)
    await env.claimGovernanceDripTokens({ user: 4 })
    await env.expectUserToHaveGovernanceTokens({ user: 4, tokens: '0' })
    // user 3 will still have only 100
    await env.expectUserToHaveGovernanceTokens({ user: 3, tokens: '100' })
  })
})