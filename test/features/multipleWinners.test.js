const { PoolEnv } = require('./support/PoolEnv')

describe('Multiple Winners Feature', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should be possible for one person to win', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.useMultipleWinnersPrizeStrategy({ winnerCount: 1 })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.poolAccrues({ tickets: 100 })
    await env.awardPrizeToToken({ token: 2 }) // just happens to keccak hash to the other player
    await env.expectUserToHaveTickets({ user: 1, tickets: 200 })
  })

  it('should be possible for two people to win', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.useMultipleWinnersPrizeStrategy({ winnerCount: 2 })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.buyTickets({ user: 2, tickets: 100 })
    await env.poolAccrues({ tickets: 100 })
    await env.awardPrizeToToken({ token: 90 }) // just happens to award both players
    await env.expectUserToHaveTickets({ user: 1, tickets: 150 })
    await env.expectUserToHaveTickets({ user: 2, tickets: 150 })
  })

})
