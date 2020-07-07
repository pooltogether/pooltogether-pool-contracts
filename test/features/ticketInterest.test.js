const { PoolEnv } = require('./support/PoolEnv')

describe('Ticket Interest Feature', () => {

  let env

  beforeEach(() => {
    env = new PoolEnv()
  })

  it('should earn interest on held tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10 })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.poolAccrues({ tickets: 100 })
    await env.awardPrize()
    await env.expectUserToHaveTickets({ user: 1, tickets: 200 })
    await env.expectUserToHaveTicketCredit({ user: 1, interest: 100 })
  })

  it('should not earn interest for late comers to the pool', async () => {
    await env.createPool({ prizePeriodSeconds: 10 })
    await env.buyTickets({ user: 1, tickets: 100 })
    await env.poolAccrues({ tickets: 100 })
    await env.buyTickets({ user: 2, tickets: 100 })
    await env.awardPrizeToToken({ token: 1 })
    await env.expectUserToHaveTicketCredit({ user: 1, interest: 100 })
    await env.expectUserToHaveTicketCredit({ user: 2, interest: 0 })
  })

  it('should earn partial interest on tickets', async () => {
    await env.createPool({ prizePeriodSeconds: 10 })
    await env.buyTickets({ user: 1, tickets: 100 })
    // records index at 1

    await env.poolAccrues({ tickets: 50 })

    await env.buyTickets({ user: 2, tickets: 100 })
    // 50 has accrued on 100, so index is

    await env.poolAccrues({ tickets: 50 })
    // 50 accrues on 250.  However, we know that there are 200 tokens.

    await env.awardPrizeToToken({ token: 1 })

/*

    


    + user deposits 100
    + 50 interest accrues
    = 100 principal record interest / tokens at 1.5

    + deposits 100, record interest rate of 1.5
    + 50 interest accrues: new interest = 50 / 250.0 = 0.2
     change over previous = 1.2 * 1.5 = 1.8
    + user deposits 100

    

    user 2 interest = 20
    = 

    + 50 interest accrues.  One user had 150, the other had 100.  meaning one gets 150/250 and the other gets 100/250

    - what is new interest rate?



*/

    /*
    
    credit = tokens * (interest / token)

    if last time there was 1.5 interest per token, and now it's 1.8, then 0.3 accrued
    
    
    // tokens * (end interest / token - starting interest / token)
    // interest per token?

    // when we calculate the new interestPerToken, we are also accounting for compound interest





    // => 100 * ? = 20 => ? = 20 / 100 = 0.2
    // => 100 * ? = 80 => ? = 80 / 100 = 0.8

    */
    // given that the user began with a rate of 1, we expect (endRate - startRate) * tokens = 80) => (endRate * 100 - 1 * 100 = 80) => endRate * 100 = 80 + 100 = endRate = 1.8
    await env.expectUserToHaveTicketCredit({ user: 1, interest: 80 })

    // given that the user began with a rate of 1.5, we expect (end rate - start rate * tokens = 20) => (endRate - 1.5 * 100 = 20) => endRate = 1.7
    await env.expectUserToHaveTicketCredit({ user: 2, interest: 20 }) // user 1 should have 150/250 of 50, and user 2 has 100/250 of 50
  })

})