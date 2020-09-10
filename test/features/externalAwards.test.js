const { PoolEnv } = require('./support/PoolEnv')

describe('External Awards', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should award external ERC20 tokens', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01', externalERC20Awards: ['COMP'] })
    await env.accrueExternalAwardAmount({ externalAward: 'COMP', amount: '1' })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.awardPrize()
    await env.expectUserToHaveExternalAwardAmount({ user: 1, externalAward: 'COMP', amount: '1' })
  })

  it('should award external ERC721 tokens', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01', externalERC20Awards: [] })
    await env.addExternalAwardERC721({ user: 0, tokenId: 1 })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.awardPrize()
    await env.expectUserToHaveExternalAwardToken({ user: 1, tokenId: 1 })
  })

})