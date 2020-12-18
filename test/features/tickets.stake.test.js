const { PoolEnv } = require('./support/PoolEnv')
const debug = require('debug')('ptv3:PoolEnv')


describe('Stake Pool Feature', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should be possible to stake token', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01' , stakePool : true})
    debug("purchasing tickets")
    //change to stake tokens
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.buyTickets({ user: 2, tickets: 50 })
    
    await env.expectUserToHaveTickets({ user: 1, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 2, tickets: 50 })
  })
})