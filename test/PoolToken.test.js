const PoolContext = require('./helpers/PoolContext')
const toWei = require('./helpers/toWei')
const BN = require('bn.js')
const chai = require('./helpers/chai')
const {
  ZERO_ADDRESS,
  ERC_20_INTERFACE_HASH,
  ERC_777_INTERFACE_HASH,
  TOKENS_SENDER_INTERFACE_HASH,
  TOKENS_RECIPIENT_INTERFACE_HASH
} = require('./helpers/constants')

const PoolToken = artifacts.require('PoolTokenDecimals.sol')
const MockERC777Sender = artifacts.require('MockERC777Sender.sol')
const MockERC777Recipient = artifacts.require('MockERC777Recipient.sol')

const debug = require('debug')('Pool.ERC777.test.js')

contract('PoolToken', (accounts) => {
  const [owner, admin, user1, user2] = accounts

  let poolContext = new PoolContext({ web3, artifacts, accounts })

  let poolToken
  let pool, token, registry

  beforeEach(async () => {
    feeFraction = new BN('0')
    await poolContext.init()
    pool = await poolContext.createPool()
    token = poolContext.token
    moneyMarket = poolContext.moneyMarket
    registry = poolContext.registry
  })

  describe('init()', () => {
    beforeEach(async () => {
      poolToken = await PoolToken.new()
    })

    it('requires the name to be defined', async () => {
      await chai.assert.isRejected(poolToken.init('', 'FBAR', [owner], pool.address), /PoolToken\/name/)
    })

    it('requires the symbol to be defined', async () => {
      await chai.assert.isRejected(poolToken.init('Foobar', '', [owner], pool.address), /PoolToken\/symbol/)
    })

    it('requires the pool to be defined', async () => {
      await chai.assert.isRejected(poolToken.init('Foobar', 'fbar', [owner], ZERO_ADDRESS), /PoolToken\/pool-zero/)
    })

    it('should work', async () => {
      await poolToken.init('Foobar', 'FBAR', [owner], pool.address)
      assert.equal(await poolToken.name(), 'Foobar')
      assert.equal(await poolToken.symbol(), 'FBAR')
      assert.equal(await poolToken.decimals(), '18')
      assert.deepEqual(await poolToken.defaultOperators(), [owner])
      assert.equal(await poolToken.pool(), pool.address)
      assert.ok(await registry.getInterfaceImplementer(poolToken.address, ERC_20_INTERFACE_HASH), poolToken.address)
      assert.ok(await registry.getInterfaceImplementer(poolToken.address, ERC_777_INTERFACE_HASH), poolToken.address)
    })

    it('should allow the user to set the decimals', async () => {
      await poolToken.init('Foobar', 'FBAR', [owner], pool.address, 6)
      assert.equal(await poolToken.decimals(), '6')
    })
  })

  describe('with a pool with a default operator', () => {
    beforeEach(async () => {
      poolToken = await PoolToken.new()
      await poolToken.init('Foobar', 'FBAR', [owner], pool.address)
    })

    describe('revokeOperator()', () => {
      it('should allow users to revoke the operator', async () => {
        await poolToken.revokeOperator(owner, { from: user2 })
        assert.ok(!(await poolToken.isOperatorFor(owner, user2)), "is still an operator for")
      })
    })

    describe('authorizeOperator()', () => {
      it('should allow users to revoke the default operator then add them back', async () => {
        await poolToken.revokeOperator(owner, { from: user2 })
        assert.ok(!(await poolToken.isOperatorFor(owner, user2)), "is still an operator for")

        await poolToken.authorizeOperator(owner, { from: user2 })
        assert.ok(await poolToken.isOperatorFor(owner, user2), "is not an operator for")
      })
    })

    describe('operatorRedeem()', () => {
      it('should not allow someone to redeem the zero address tokens', async () => {
        await chai.assert.isRejected(poolToken.operatorRedeem(ZERO_ADDRESS, toWei('10'), [], []), /PoolToken\/from-zero/)
      })
    })

    describe('operatorSend()', () => {
      it('should not send tokens from zero address', async () => {
        await chai.assert.isRejected(poolToken.operatorSend(ZERO_ADDRESS, user1, toWei('10'), [], []), /PoolToken\/from-zero/)
      })
    })
  })

  describe('with a fully initialized pool', () => {
    beforeEach(async () => {
      poolToken = await poolContext.createToken()
    })

    describe('decimals()', () => {
      it('should equal 18', async () => {
        assert.equal(await poolToken.decimals(), '18')
      })
    })

    describe('granularity()', () => {
      it('the smallest indivisible unit should be 1', async () => {
        assert.equal(await poolToken.granularity(), '1')
      })
    })

    describe('totalSupply()', () => {
      it('total supply should be correct', async () => {
        assert.equal(await poolToken.totalSupply(), toWei('0'))
        await poolContext.nextDraw()
        await poolContext.depositPool(toWei('10'))
        assert.equal(await poolToken.totalSupply(), toWei('0'))
        await poolContext.nextDraw()
        assert.equal(await poolToken.totalSupply(), toWei('10'))
      })
    })

    describe('send()', () => {
      it('should send tokens to another user', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        await poolToken.send(user2, toWei('10'), [])
        assert.equal(await poolToken.balanceOf(owner), toWei('0'))
        assert.equal(await poolToken.balanceOf(user2), toWei('10'))
      })

      it('should revert if sending to the burner address', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        await chai.assert.isRejected(poolToken.send(ZERO_ADDRESS, toWei('10'), []), /PoolToken\/to-zero/)
      })

      it('should work if sending zero', async () => {
        await poolContext.nextDraw() // ensure committed
        await poolToken.send(user2, toWei('0'), [])
        assert.equal(await poolToken.balanceOf(owner), toWei('0'))
        assert.equal(await poolToken.balanceOf(user2), toWei('0'))
      })

      describe('when sender has IERC777Sender interface', () => {
        let sender

        beforeEach(async () => {
          sender = await MockERC777Sender.new()
          assert.equal(await registry.getManager(owner), owner)
          await registry.setInterfaceImplementer(owner, TOKENS_SENDER_INTERFACE_HASH, sender.address)
        })

        it('should call the interface', async () => {
          await poolContext.depositPool(toWei('10'))
          await poolContext.nextDraw()
          await poolToken.send(user2, toWei('10'), [])
          assert.equal(await sender.count(), '1')
        })
      })

      describe('when recipient has IERC777Recipient interface', () => {
        let recipient

        beforeEach(async () => {
          recipient = await MockERC777Recipient.new()
          await registry.setInterfaceImplementer(user2, TOKENS_RECIPIENT_INTERFACE_HASH, recipient.address, { from: user2 })
        })

        it('should call the interface', async () => {
          await poolContext.depositPool(toWei('10'))
          await poolContext.nextDraw()
          await poolToken.send(user2, toWei('10'), [])
          assert.equal(await recipient.count(), '1')
        })
      })

      describe('when recipient does not have IERC777Recipient interface', () => {
        it('should succeed for EOA addresses', async () => {
          await poolContext.depositPool(toWei('10'))
          await poolContext.nextDraw()
          await poolToken.send(user2, toWei('10'), [])
          assert.equal(await poolToken.balanceOf(user2), toWei('10'))
        })

        // notice that here we relax the ERC777 restrictions
        it('should NOT fail for contract addresses without ERC777Recipient interfaces', async () => {
          let recipient = await MockERC777Recipient.new()
          await poolContext.depositPool(toWei('10'))
          await poolContext.nextDraw()
          await poolToken.send(recipient.address, toWei('10'), [])
          assert.equal(await poolToken.balanceOf(recipient.address), toWei('10'))
        })
      })
    })

    describe('transfer()', () => {
      it('should fail when the pool is locked', async () => {
        await pool.lockTokens()
        await chai.assert.isRejected(poolToken.transfer(user2, toWei('10')), /PoolToken\/is-locked/)
      })

      it('should transfer tokens to another user', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        await poolToken.transfer(user2, toWei('10'))
        assert.equal(await poolToken.balanceOf(owner), toWei('0'))
        assert.equal(await poolToken.balanceOf(user2), toWei('10'))
      })

      it('should revert if transferring to the burner address', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        await chai.assert.isRejected(poolToken.transfer(ZERO_ADDRESS, toWei('10')), /PoolToken\/transfer-zero/)
      })

      it('should work if transferring zero', async () => {
        await poolContext.nextDraw() // ensure committed draw
        await poolToken.transfer(user2, toWei('0'))
        assert.equal(await poolToken.balanceOf(owner), toWei('0'))
        assert.equal(await poolToken.balanceOf(user2), toWei('0'))
      })

      it('should reject when transferring to zero address', async () => {
        await chai.assert.isRejected(poolToken.transfer(ZERO_ADDRESS, toWei('0')), /PoolToken\/transfer-zero/)
      })
    })

    describe('poolRedeem()', async () => {
      it('should only be callable by the pool', async () => {
        await chai.assert.isRejected(poolToken.poolRedeem(user1, toWei('0')), /PoolToken\/only-pool/)
      })
    })

    describe('poolMint()', async () => {
      it('should only be callable by the pool', async () => {
        await chai.assert.isRejected(poolToken.poolMint(toWei('0')), /PoolToken\/only-pool/)
      })
    })

    describe('burn()', () => {
      it('should revert', async () => {
        await chai.assert.isRejected(poolToken.burn(toWei('0'), []), /PoolToken\/no-support/)
      })
    })

    describe('operatorBurn()', () => {
      it('should revert', async () => {
        await chai.assert.isRejected(poolToken.operatorBurn(user1, toWei('0'), [], []), /PoolToken\/no-support/)
      })
    })

    describe('redeem()', () => {
      it('should be okay to redeem nothing', async () => {
        await poolContext.nextDraw() // ensure committed draw
        await poolToken.redeem('0', [])
      })

      it('should allow a user to redeem some of their tokens', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        let beforeBalance = await token.balanceOf(owner)
        await poolToken.redeem(toWei('10'), [])
        assert.equal(await poolToken.balanceOf(owner), toWei('0'))
        let afterBalance = await token.balanceOf(owner)

        assert.equal(afterBalance, beforeBalance.add(new BN(toWei('10'))).toString())
      })
    })

    describe('isOperatorFor()', () => {
      it('should be that a user is an operator for themselves', async () => {
        assert.ok(await poolToken.isOperatorFor(owner, owner))
      })

      it('should be false when a non-operator is checked', async () => {
        assert.ok(!(await poolToken.isOperatorFor(owner, user1)))
      })

      it('should be true when someone is added as an operator', async () => {
        await poolToken.authorizeOperator(user1)
        assert.ok(await poolToken.isOperatorFor(user1, owner))
      })
    })

    describe('authorizeOperator()', () => {
      it('should allow someone to add an operator', async () => {
        await poolToken.authorizeOperator(user1)
        assert.ok(await poolToken.isOperatorFor(user1, owner))
      })

      it('should not allow someone to add themselves', async () => {
        let failed = false
        try {
          await poolToken.authorizeOperator(owner)
        } catch (e) {
          failed = true
        }
        assert.ok(failed, "was able to add self as operator")
      })
    })

    describe('revokeOperator()', () => {
      it('should allow someone to revoke an operator', async () => {
        await poolToken.authorizeOperator(user1)
        assert.ok(await poolToken.isOperatorFor(user1, owner))
        await poolToken.revokeOperator(user1)
        assert.ok(!(await poolToken.isOperatorFor(user1, owner)))
      })

      it('should not allow someone to revoke themselves', async () => {
        let failed = false
        try {
          await poolToken.revokeOperator(owner)
        } catch (e) {
          failed = true
        }
        assert.ok(failed, "was able to revoke self as operator")
      })
    })

    describe('defaultOperators()', () => {
      it('should be an empty array', async () => {
        assert.deepEqual(await poolToken.defaultOperators(), [])
      })
    })

    describe('operatorSend()', () => {
      it('should allow an operator to send tokens on behalf of another user', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        await poolToken.authorizeOperator(user1)
        await poolToken.operatorSend(owner, user2, toWei('10'), [], [], { from: user1 })
        assert.equal(await poolToken.balanceOf(owner), toWei('0'))
        assert.equal(await poolToken.balanceOf(user2), toWei('10'))
      })

      it('should not allow an non-authorized operator to send tokens on behalf of another user', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        let failed = false
        try {
          await poolToken.operatorSend(owner, user2, toWei('10'), [], [], { from: user2 })
        } catch (e) {
          failed = true
        }
        assert.ok(failed, "was able to send other peoples tokens")
      })

      it('should not allow an operator to send from the zero address', async () => {
        let failed = false
        try {
          await poolToken.operatorSend(ZERO_ADDRESS, user2, toWei('10'), [], [], { from: user2 })
        } catch (e) {
          failed = true
        }
        assert.ok(failed, "was able to send from zero address")
      })

      it('should not allow an operator to send to the zero address', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        await poolToken.authorizeOperator(user1)
        let failed = false
        try {
          await poolToken.operatorSend(owner, ZERO_ADDRESS, toWei('10'), [], [], { from: user2 })
        } catch (e) {
          failed = true
        }
        assert.ok(failed, "was able to send from zero address")
      })

      it('should not allow an operator to send more tokens than their balance', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        await poolToken.authorizeOperator(user1)
        let failed = false
        try {
          await poolToken.operatorSend(owner, user2, toWei('12'), [], [], { from: user2 })
        } catch (e) {
          failed = true
        }
        assert.ok(failed, "was able to send other peoples tokens")
      })
    })

    describe('operatorRedeem()', () => {
      it('should allow an operator to redeem someones tokens', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        await poolToken.authorizeOperator(user1)
        let beforeBalance = await token.balanceOf(owner)
        await poolToken.operatorRedeem(owner, toWei('10'), [], [], { from: user1 })
        assert.equal(await poolToken.balanceOf(owner), toWei('0'))
        let afterBalance = await token.balanceOf(owner)

        assert.equal(afterBalance, beforeBalance.add(new BN(toWei('10'))).toString())
      })

      it('should not allow an non-authorized operator to redeem someones tokens', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        let failed = false
        try {
          await poolToken.operatorRedeem(owner, toWei('10'), [], [], { from: user1 })
        } catch (e) {
          failed = true
        }
        assert.ok(failed, "was able to redeem tokens")
      })

      it('should not allow someone to redeem the zero address tokens', async () => {
        let failed = false
        try {
          await poolToken.operatorRedeem(ZERO_ADDRESS, toWei('10'), [], [], { from: user1 })
        } catch (e) {
          failed = true
        }
        assert.ok(failed, "was able to redeem tokens")
      })

      it('should not allow the redeem to exceed the balance', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        await poolToken.authorizeOperator(user1)
        let failed = false
        try {
          await poolToken.operatorRedeem(owner, toWei('12'), [], [], { from: user1 })
        } catch (e) {
          failed = true
        }
        assert.ok(failed, "was able to redeem tokens")
      })
    })

    describe('allowance() & approve()', () => {
      it('should not allow someone to approve the zero address', async () => {
        let failed = false
        try {
          await poolToken.approve(ZERO_ADDRESS, toWei('5'))
        } catch (e) {
          failed = true
        }
        assert.ok(failed, "was able to approve zero address")
      })

      it('should return the number of tokens that are approved to spend', async () => {
        await poolToken.approve(user1, toWei('5'))
        assert.equal(await poolToken.allowance(owner, user1), toWei('5'))
      })
    })

    describe('increaseAllowance()', () => {
      it('should allow a user to increase their allowance incrementally', async () => {
        await poolToken.approve(user1, toWei('5'))
        await poolToken.increaseAllowance(user1, toWei('5'))
        assert.equal(await poolToken.allowance(owner, user1), toWei('10'))
      })
    })

    describe('decreaseAllowance()', () => {
      it('should allow a user to decrease their allowance incrementally', async () => {
        await poolToken.approve(user1, toWei('10'))
        await poolToken.decreaseAllowance(user1, toWei('5'))
        assert.equal(await poolToken.allowance(owner, user1), toWei('5'))
      })
    })

    describe('transferFrom()', () => {
      beforeEach(async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
      })

      it('should allow a spender to transfer tokens', async () => {
        await poolToken.approve(user1, toWei('5'))

        await poolToken.transferFrom(owner, user2, toWei('5'), { from: user1 })

        assert.equal(await poolToken.balanceOf(owner), toWei('5'))
        assert.equal(await poolToken.balanceOf(user2), toWei('5'))

        // they have consumed their allowance
        assert.equal(await poolToken.allowance(owner, user1), '0')
      })

      it('should fail if a spender tries to spend more than their allowance', async () => {
        await poolToken.approve(user1, toWei('5'))

        let failed = false
        try {
          await poolToken.transferFrom(owner, user2, toWei('10'), { from: user1 })
        } catch (e) {
          failed = true
        }

        assert.ok(failed, "was able to transfer beyond allowance")
      })

      it('should fail if the recipient is zero', async () => {
        await poolToken.approve(user1, toWei('5'))

        let failed = false
        try {
          await poolToken.transferFrom(owner, ZERO_ADDRESS, toWei('5'), { from: user1 })
        } catch (e) {
          failed = true
        }

        assert.ok(failed, "was able to transfer to zero address")
      })

      it('should fail if the from is zero', async () => {
        await poolToken.approve(user1, toWei('5'))

        let failed = false
        try {
          await poolToken.transferFrom(ZERO_ADDRESS, user2, toWei('5'), { from: user1 })
        } catch (e) {
          failed = true
        }

        assert.ok(failed, "was able to transfer to zero address")
      })
    })
  })
})
