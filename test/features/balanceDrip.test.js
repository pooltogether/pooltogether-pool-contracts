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
    await env.setCurrentTime(0)
    await env.balanceDripGovernanceTokenAtRate({ dripRatePerSecond: toWei('0.0001') })
    await env.setCurrentTime(10)
    await env.buyTickets({ user: 1, tickets: '10' })
    await env.setCurrentTime(50)
    await env.withdrawInstantly({ user: 1, tickets: '10' })
    await env.claimBalanceDripGovernanceTokens({ user: 1 })
    await env.expectUserToHaveTokens({ user: 1, tokens: '10' })
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '0.004' })
  })
})
