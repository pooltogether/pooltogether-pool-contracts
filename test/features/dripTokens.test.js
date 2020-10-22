const { PoolEnv } = require('./support/PoolEnv')

const debug = require('debug')('ptv3:dripTokens.test')

const toWei = (val) => ethers.utils.parseEther('' + val)

describe('Drip Tokens', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should handle multiple drips of the same token without over-dripping', async () => {
    await env.createPool({ prizePeriodStart: 0, prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })

    await env.balanceDripGovernanceTokenAtRate({ dripRatePerSecond: toWei('0.1') })            // 10000 minted to comptroller
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, endTime: 40 }) // 10000 minted to comptroller

    // reduce governance drip-token balance to 150
    await env.burnGovernanceTokensFromComptroller({ amount: '19850' })

    await env.setCurrentTime(10)
    await env.buyTickets({ user: 1, tickets: '100' })

    await env.setCurrentTime(40)

    await env.claimGovernanceDripTokens({ user: 1 })
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '103' })

    await env.setCurrentTime(500)

    await env.claimGovernanceDripTokens({ user: 1 })
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '149' })

    await env.setCurrentTime(600)

    await env.claimGovernanceDripTokens({ user: 1 })
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '150' }) // should not exceed 150
  })
})
