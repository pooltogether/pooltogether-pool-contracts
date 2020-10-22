const { PoolEnv } = require('./support/PoolEnv')
const ethers = require('ethers')

const toWei = (val) => ethers.utils.parseEther('' + val)

describe('Balance drip', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should drip users governance tokens', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
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
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
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

  it('should deactivate the drip when all tokens have been distributed', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.balanceDripGovernanceTokenAtRate({ dripRatePerSecond: toWei('0.1') })
    // reduce drip-token balance to 10
    await env.burnGovernanceTokensFromComptroller({ amount: '9990' })
    // user 1 will get all of the available drip tokens
    await env.setCurrentTime(10)
    await env.buyTickets({ user: 1, tickets: '100' })
    await env.setCurrentTime(110)
    await env.claimGovernanceDripTokens({ user: 1 })
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '10' })
    // user 2 will not receive any drip tokens after deactivation
    await env.setCurrentTime(120)
    await env.buyTickets({ user: 2, tickets: '100' })
    await env.setCurrentTime(150)
    await env.claimGovernanceDripTokens({ user: 2 })
    await env.expectUserToHaveGovernanceTokens({ user: 2, tokens: '0' })
  })
})
