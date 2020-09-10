const { PoolEnv } = require('./support/PoolEnv')
const ethers = require('ethers')

describe('Referral volume drip', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should drip users governance tokens', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.setCurrentTime(20)
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, endTime: 30, isReferral: true })
    await env.setCurrentTime(30)
    await env.buyTickets({ user: 1, tickets: '10', referrer: 2 })
    await env.setCurrentTime(40)
    await env.claimGovernanceDripTokens({ user: 2 })
    await env.expectUserToHaveGovernanceTokens({ user: 2, tokens: '100' })
  })

  it("should split the volume between users", async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.setCurrentTime(0)
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, endTime: 30, isReferral: true })
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
})