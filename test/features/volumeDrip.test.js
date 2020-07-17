const { PoolEnv } = require('./support/PoolEnv')
const ethers = require('ethers')

const toWei = (val) => ethers.utils.parseEther('' + val)

describe('Volume drip', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should drip users governance tokens', async () => {
    await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, startTime: 20 })
    await env.buyTicketsAtTime({ user: 1, tickets: '10', elapsed: 30 })
    await env.claimVolumeDripGovernanceTokensAtTime({ user: 1, elapsed: 40 })
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '100' })
  })

  it('should accrue over multiple periods', async () => {
    await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, startTime: 0 })
    
    await env.buyTicketsAtTime({ user: 1, tickets: '10', elapsed: 5 })

    await env.buyTicketsAtTime({ user: 1, tickets: '10', elapsed: 15 })

    // now we're the next volume period, so we accrue
    await env.claimVolumeDripGovernanceTokensAtTime({ user: 1, elapsed: 21 })
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '200' })
  })

  it('should allow users to claim multiple times', async () => {
    await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, startTime: 0 })
    
    await env.buyTicketsAtTime({ user: 1, tickets: '10', elapsed: 5 })
    await env.claimVolumeDripGovernanceTokensAtTime({ user: 1, elapsed: 15 })
    await env.buyTicketsAtTime({ user: 1, tickets: '10', elapsed: 15 })
    await env.claimVolumeDripGovernanceTokensAtTime({ user: 1, elapsed: 25 })

    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '200' })
  })

  it("should split the volume between users", async () => {
    await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, startTime: 20 })
    await env.buyTicketsAtTime({ user: 1, tickets: '10', elapsed: 30 })
    await env.buyTicketsAtTime({ user: 2, tickets: '30', elapsed: 30 })
    await env.claimVolumeDripGovernanceTokensAtTime({ user: 1, elapsed: 40 })
    await env.claimVolumeDripGovernanceTokensAtTime({ user: 2, elapsed: 60 })
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '25' })
    await env.expectUserToHaveGovernanceTokens({ user: 2, tokens: '75' })
  })
})
