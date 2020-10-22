const { PoolEnv } = require('./support/PoolEnv')

const debug = require('debug')('ptv3:PoolEnv')

describe('Tickets.yVault Feature', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should be possible to purchase tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01', yVault: true })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.buyTickets({ user: 2, tickets: 50 })
    await env.expectUserToHaveTickets({ user: 1, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 2, tickets: 50 })
  })

  it('should be possible to win tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01', yVault: true })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 1, tickets: 100 })
    await env.poolAccrues({ tickets: 100 })
    await env.awardPrizeToToken({ token: 0 })
    await env.expectUserToHaveTickets({ user: 1, tickets: 190 })
  })

  it('should account for reserve fees when awarding prizes', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01', yVault: true })
    await env.setReserveRate({ rate: '0.01' })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 1, tickets: 100 })
    await env.poolAccrues({ tickets: 100 })
    await env.awardPrize()
    await env.expectUserToHaveTickets({ user: 1, tickets: '189.1' })
  })

  it('should allow all users to withdraw with no Vault Fee', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01', yVault: true })

    await env.buyTickets({ user: 1, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 1, tickets: 100 })

    await env.buyTickets({ user: 2, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 2, tickets: 100 })

    await env.buyTickets({ user: 3, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 3, tickets: 100 })

    await env.buyTickets({ user: 4, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 4, tickets: 100 })

    // Award Prize
    await env.poolAccrues({ tickets: 100 })
    await env.awardPrizeToToken({ token: 399 })
    await env.expectUserToHaveTickets({ user: 1, tickets: 175 })

    // Advance Time
    await env.setCurrentTime(10)

    // Test Withdrawals
    await env.withdrawInstantly({ user: 2, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 2, tickets: 0 })

    await env.withdrawInstantly({ user: 3, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 3, tickets: 0 })

    await env.withdrawInstantly({ user: 4, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 4, tickets: 0 })

    await env.withdrawInstantly({ user: 1, tickets: 175 })
    await env.expectUserToHaveTickets({ user: 1, tickets: 0 })

    // Unused yEarn Vault fees
    await env.expectPoolToHavePrize({ tickets: 0 })
  })

  it('should allow all users to withdraw with a Vault Fee', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01', yVault: true })
    await env.setReserveRate({ rate: '0.01' })

    await env.buyTickets({ user: 1, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 1, tickets: 100 })

    await env.buyTickets({ user: 2, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 2, tickets: 100 })

    await env.buyTickets({ user: 3, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 3, tickets: 100 })

    await env.buyTickets({ user: 4, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 4, tickets: 100 })

    // Award Prize
    await env.poolAccrues({ tickets: 100 })
    await env.awardPrizeToToken({ token: 399 })
    await env.expectUserToHaveTickets({ user: 1, tickets: '174.25' })

    // Advance Time
    await env.setCurrentTime(10)

    // Test Withdrawals
    await env.withdrawInstantly({ user: 2, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 2, tickets: 0 })

    await env.withdrawInstantly({ user: 3, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 3, tickets: 0 })

    await env.withdrawInstantly({ user: 4, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 4, tickets: 0 })

    await env.withdrawInstantly({ user: 1, tickets: '174.25' })
    await env.expectUserToHaveTickets({ user: 1, tickets: 0 })

    // Unused yEarn Vault fees
    await env.expectPoolToHavePrize({ tickets: 0 })
  })

  it('should allow all users to withdraw with a fluxuating Vault Fee', async () => {
    await env.createPool({ prizePeriodSeconds: 10, creditLimit: '0.1', creditRate: '0.01', yVault: true })
    await env.setReserveRate({ rate: '0.01' })

    await env.buyTickets({ user: 1, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 1, tickets: 100 })

    await env.buyTickets({ user: 2, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 2, tickets: 100 })

    await env.buyTickets({ user: 3, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 3, tickets: 100 })

    await env.buyTickets({ user: 4, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 4, tickets: 100 })

    // Award Prize
    await env.poolAccrues({ tickets: 100 })
    await env.awardPrizeToToken({ token: 399 })
    await env.expectUserToHaveTickets({ user: 1, tickets: '174.25' })

    // Advance Time
    await env.setCurrentTime(10)

    // Test Withdrawals
    await env.withdrawInstantly({ user: 2, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 2, tickets: 0 })

    // Modify yEarn Vault Fees
    await env.setVaultFeeMantissa({ fee: 0 })

    await env.withdrawInstantly({ user: 3, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 3, tickets: 0 })

    await env.withdrawInstantly({ user: 4, tickets: 100 })
    await env.expectUserToHaveTickets({ user: 4, tickets: 0 })

    await env.withdrawInstantly({ user: 1, tickets: '174.25' })
    await env.expectUserToHaveTickets({ user: 1, tickets: 0 })

    // Unused yEarn Vault fees
    await env.expectPoolToHavePrize({ tickets: '18.525375' })
  })

})