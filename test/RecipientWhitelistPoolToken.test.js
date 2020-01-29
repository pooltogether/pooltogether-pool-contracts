const PoolContext = require('./helpers/PoolContext')
const toWei = require('./helpers/toWei')
const BN = require('bn.js')
const chai = require('./helpers/chai')

contract('RecipientWhitelistPoolToken', (accounts) => {
  const [owner, admin, user1, user2] = accounts

  let poolContext = new PoolContext({ web3, artifacts, accounts })

  let pool

  beforeEach(async () => {
    feeFraction = new BN('0')
    await poolContext.init()
    result = poolContext
  })

  describe('with a fully initialized pool', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool()
      poolToken = await poolContext.createToken()
    })

    describe('setRecipientWhitelistEnabled(bool _enabled)', () => {
      it('should work', async () => {
        await poolToken.setRecipientWhitelistEnabled(true)
      })
    })

    describe('recipientWhitelistEnabled()', () => {
      it('should enable the whitelist', async () => {
        await poolToken.setRecipientWhitelistEnabled(true)
        assert.equal(await poolToken.recipientWhitelistEnabled(), true)
      })
      
      it('should disable the whitelist', async () => {
        await poolToken.setRecipientWhitelistEnabled(true)
        await poolToken.setRecipientWhitelistEnabled(false)
        assert.equal(await poolToken.recipientWhitelistEnabled(), false)
      })
    })

    describe('setRecipientWhitelisted(address _recipient, bool _whitelisted)', () => {
      it('should work', async () => {
        await poolToken.setRecipientWhitelisted(owner, true)
      })
    })

    describe('recipientWhitelisted(address _recipient)', () => {
      it('should test whether an address is whitelisted', async () => {
        assert.equal(await poolToken.recipientWhitelisted(owner), false)
        await poolToken.setRecipientWhitelisted(owner, true)
        assert.equal(await poolToken.recipientWhitelisted(owner), true)
      })
    })

    describe('with whitelisting enabled', () => {
      beforeEach(async () => {
        await poolToken.setRecipientWhitelistEnabled(true)
        await poolContext.depositPool(toWei('10'), { from: user1 })
        await poolContext.nextDraw()
      })

      describe('transfer()', () => {
        it('should not be allowed', async () => {
          await chai.assert.isRejected(poolToken.transfer(user2, toWei('10'), { from: user1 }), /Pool\/not-list/)
        })

        it('should be allowed for whitelist', async () => {
          await poolToken.setRecipientWhitelisted(user2, true)
          await poolToken.transfer(user2, toWei('10'), { from: user1 })
        })
      })
      
      describe('send()', () => {
        it('should not be allowed', async () => {
          await chai.assert.isRejected(poolToken.send(user2, toWei('10'), [], { from: user1 }), /Pool\/not-list/)
        })

        it('should be allowed for whitelist', async () => {
          await poolToken.setRecipientWhitelisted(user2, true)
          await poolToken.send(user2, toWei('10'), [], { from: user1 })
        })
      })

      describe('redeem()', () => {
        it('should work', async () => {
          await poolToken.redeem(toWei('10'), [], { from: user1 })
        })
      })
    })
  })
})
