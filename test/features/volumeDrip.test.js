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
    await env.setCurrentTime(0)
    await env.balanceDripGovernanceTokenAtRate({ dripRatePerSecond: toWei('0.0001') })
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, startTime: 25 })
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, startTime: 20 })
    await env.setCurrentTime(30)
    await env.buyTickets({ user: 1, tickets: '10' })
    await env.setCurrentTime(31)
    await env.buyTickets({ user: 1, tickets: '10' })
    await env.setCurrentTime(32)
    await env.buyTickets({ user: 1, tickets: '10' })
    await env.setCurrentTime(40)
    await env.claimVolumeDrip({ user: 1, index: 1 })
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '100' })
  })

  it('should accrue over multiple periods', async () => {
    await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
    await env.setCurrentTime(0)
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, startTime: 0 })
    await env.setCurrentTime(5)
    await env.buyTickets({ user: 1, tickets: '10' })
    await env.setCurrentTime(15)
    await env.buyTickets({ user: 1, tickets: '10' })

    // now we're the next volume period, so we accrue
    await env.setCurrentTime(21)
    await env.claimVolumeDrip({ user: 1, index: 1 })
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '200' })
  })

  it('should allow users to claim multiple times', async () => {
    await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
    await env.setCurrentTime(0)
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, startTime: 0 })

    await env.setCurrentTime(5)
    await env.buyTickets({ user: 1, tickets: '10' })
    await env.setCurrentTime(15)
    await env.claimVolumeDrip({ user: 1, index: 1 })
    await env.buyTickets({ user: 1, tickets: '10' })
    await env.setCurrentTime(25)
    await env.claimVolumeDrip({ user: 1, index: 1 })

    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '200' })
  })

  it("should split the volume between users", async () => {
    await env.createPool({ prizePeriodSeconds: 10, exitFee: '0.1', creditRate: '0.01' })
    await env.setCurrentTime(0)
    await env.volumeDripGovernanceToken({ dripAmount: '100', periodSeconds: 10, startTime: 20 })
    await env.setCurrentTime(30)
    await env.buyTickets({ user: 1, tickets: '10' })
    await env.buyTickets({ user: 2, tickets: '30' })
    await env.setCurrentTime(40)
    await env.claimVolumeDrip({ user: 1, index: 1 })
    await env.setCurrentTime(60)
    await env.claimVolumeDrip({ user: 2, index: 1 })
    await env.expectUserToHaveGovernanceTokens({ user: 1, tokens: '25' })
    await env.expectUserToHaveGovernanceTokens({ user: 2, tokens: '75' })
  })
})
