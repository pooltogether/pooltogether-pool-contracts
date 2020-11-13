const { PoolEnv } = require('./support/PoolEnv')
const ethers = require('ethers')

const toWei = val => ethers.utils.parseEther(val)

describe('Multiple Winners Feature', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should be possible for two people to win', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.useMultipleWinnersPrizeStrategy({ winnerCount: 2 })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.buyTickets({ user: 2, tickets: 100 })
    await env.poolAccrues({ tickets: 100 })
    await env.awardPrizeToToken({ token: 1 })
    await env.expectUserToHaveTickets({ user: 1, tickets: 150 })
    await env.expectUserToHaveTickets({ user: 2, tickets: 150 })
  })

  it('should be possible for four people to win', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' })
    await env.useMultipleWinnersPrizeStrategy({ winnerCount: 4 })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.buyTickets({ user: 2, tickets: 100 })
    await env.buyTickets({ user: 3, tickets: 100 })
    await env.buyTickets({ user: 4, tickets: 100 })
    await env.poolAccrues({ tickets: 100 })
    await env.awardPrizeToToken({ token: toWei('300') })
    await env.expectUserToHaveTickets({ user: 1, tickets: 125 })
    await env.expectUserToHaveTickets({ user: 2, tickets: 125 })
    await env.expectUserToHaveTickets({ user: 3, tickets: 125 })
    await env.expectUserToHaveTickets({ user: 4, tickets: 125 })
  })

})
