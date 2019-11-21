const PoolContext = require('./helpers/PoolContext')
const toWei = require('./helpers/toWei')
const BN = require('bn.js')
const chai = require('./helpers/chai')

contract('ERC777Pool', (accounts) => {
  const [owner, admin, user1, user2] = accounts

  let poolContext = new PoolContext({ web3, artifacts, accounts })

  let pool,
      token, moneyMarket, registry

  beforeEach(async () => {
    feeFraction = new BN('0')
    result = await poolContext.init()
    token = result.token
    moneyMarket = result.moneyMarket
    registry = result.registry
  })

  describe('with a fully initialized pool', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool()
    })

    describe('setRecipientWhitelistEnabled(bool _enabled)', () => {
      it('should work', async () => {
        await pool.setRecipientWhitelistEnabled(true)
      })
    })

    describe('recipientWhitelistEnabled()', () => {
      it('should enable the whitelist', async () => {
        await pool.setRecipientWhitelistEnabled(true)
        assert.equal(await pool.recipientWhitelistEnabled(), true)
      })
      
      it('should disable the whitelist', async () => {
        await pool.setRecipientWhitelistEnabled(true)
        await pool.setRecipientWhitelistEnabled(false)
        assert.equal(await pool.recipientWhitelistEnabled(), false)
      })
    })

    describe('setRecipientWhitelisted(address _recipient, bool _whitelisted)', () => {
      it('should work', async () => {
        await pool.setRecipientWhitelisted(owner, true)
      })
    })

    describe('recipientWhitelisted(address _recipient)', () => {
      it('should test whether an address is whitelisted', async () => {
        assert.equal(await pool.recipientWhitelisted(owner), false)
        await pool.setRecipientWhitelisted(owner, true)
        assert.equal(await pool.recipientWhitelisted(owner), true)
      })
    })

    describe('with whitelisting enabled', () => {
      beforeEach(async () => {
        await pool.setRecipientWhitelistEnabled(true)
        await poolContext.depositPool(toWei('10'), { from: user1 })
        await poolContext.nextDraw()
      })

      describe('transfer()', () => {
        it('should not be allowed', async () => {
          await chai.assert.isRejected(pool.transfer(user2, toWei('10'), { from: user1 }), /recipient is not whitelisted/)
        })

        it('should be allowed for whitelist', async () => {
          await pool.setRecipientWhitelisted(user2, true)
          await pool.transfer(user2, toWei('10'), { from: user1 })
        })
      })
      
      describe('send()', () => {
        it('should not be allowed', async () => {
          await chai.assert.isRejected(pool.send(user2, toWei('10'), [], { from: user1 }), /recipient is not whitelisted/)
        })

        it('should be allowed for whitelist', async () => {
          await pool.setRecipientWhitelisted(user2, true)
          await pool.send(user2, toWei('10'), [], { from: user1 })
        })
      })

      describe('burn()', () => {
        it('should work', async () => {
          await pool.burn(toWei('10'), [], { from: user1 })
        })
      })
    })
  })
})
