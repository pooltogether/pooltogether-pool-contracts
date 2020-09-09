const { PoolEnv } = require('./support/PoolEnv')
const ethers = require('ethers')

const toWei = (val) => ethers.utils.parseEther('' + val)

describe('Balance drip', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should drip users governance tokens', async () => {
    await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
    await env.balanceDripGovernanceTokenAtRate({ dripRatePerSecond: toWei('0.0001') })
    await env.setCurrentTime(10)
    await env.buyTickets({ user: 1, tickets: '2' })
    await env.buyTickets({ user: 1, tickets: '2' })
    await env.buyTickets({ user: 1, tickets: '2' })
    await env.buyTickets({ user: 1, tickets: '2' })
    await env.buyTickets({ user: 1, tickets: '2' })
    await env.setCurrentTime(50)
    await env.claimGovernanceDripTokens({ user: 1 })
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '0.004' })
  })

  it('should update the drips on transfer', async () => {
    await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
    await env.balanceDripGovernanceTokenAtRate({ dripRatePerSecond: toWei('0.01') })
    // offset by 10 seconds just for fun
    await env.setCurrentTime(10)
    await env.buyTickets({ user: 1, tickets: 10 })
    await env.setCurrentTime(20)
    // user has now accrued 0.01 per second over 10 seconds
    // let's transfer their tickets to user 2
    await env.transferTickets({ user: 1, tickets: 10, to: 2 })
    // both will claim now
    await env.claimGovernanceDripTokens({ user: 1 })
    await env.claimGovernanceDripTokens({ user: 2 })
    // only user 1 will receive gov tokens from the drip
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '0.1' })
    await env.expectUserToHaveGovernanceTokens({ user: 2, tokens: '0' })
    // move forward another 10 seconds
    await env.setCurrentTime(30)
    // both claim again
    await env.claimGovernanceDripTokens({ user: 1 })
    await env.claimGovernanceDripTokens({ user: 2 })
    // user 1 hasn't changed, but now user 2 has gov tokens
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '0.1' })
    await env.expectUserToHaveGovernanceTokens({ user: 2, tokens: '0.1' })
  })
})
