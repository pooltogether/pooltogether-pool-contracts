const PoolContext = require('./helpers/PoolContext')
const toWei = require('./helpers/toWei')
const BN = require('bn.js')
const {
  ERC_20_INTERFACE_HASH,
  ERC_777_INTERFACE_HASH,
  TOKENS_SENDER_INTERFACE_HASH,
  TOKENS_RECIPIENT_INTERFACE_HASH
} = require('./helpers/constants')

const MockERC777Sender = artifacts.require('MockERC777Sender.sol')
const MockERC777Recipient = artifacts.require('MockERC777Recipient.sol')

const debug = require('debug')('Pool.ERC777.test.js')

contract('Pool.ERC777', (accounts) => {
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

  describe('with a pool with a default operator', () => {
    beforeEach(async () => {
      pool = await poolContext.createPoolNoInit()
      await pool.initERC777('Foobar', 'FBAR', [owner])
    })

    describe('initERC777()', () => {
      it('should add the default operators', async () => {
        assert.equal(await pool.name(), 'Foobar')
        assert.equal(await pool.symbol(), 'FBAR')
        assert.deepEqual(await pool.defaultOperators(), [owner])
      })    
    })

    describe('revokeOperator()', () => {
      it('should allow users to revoke the operator', async () => {
        await pool.revokeOperator(owner, { from: user2 })
        assert.ok(!(await pool.isOperatorFor(user2, owner)), "is still an operator for")
      })
    })
  })

  describe('with a fully initialized pool', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool()
    })

    describe('initERC777()', () => {
      it('should setup the name, symbol and register itself with ERC 1820', async () => {
        assert.equal(await pool.name(), 'Prize Dai')
        assert.equal(await pool.symbol(), 'pzDAI')
        assert.ok(await registry.getInterfaceImplementer(pool.address, ERC_20_INTERFACE_HASH), pool.address)
        assert.ok(await registry.getInterfaceImplementer(pool.address, ERC_777_INTERFACE_HASH), pool.address)
      })    
    })
  
    describe('decimals()', () => {
      it('should equal 18', async () => {
        assert.equal(await pool.decimals(), '18')
      })
    })
  
    describe('granularity()', () => {
      it('the smallest indivisible unit should be 1', async () => {
        assert.equal(await pool.granularity(), '1')
      })
    })
  
    describe('totalSupply()', () => {
      it('total supply should be correct', async () => {
        assert.equal(await pool.totalSupply(), toWei('0'))
        await poolContext.nextDraw()
        await poolContext.depositPool(toWei('10'))
        assert.equal(await pool.totalSupply(), toWei('0'))
        await poolContext.nextDraw()
        assert.equal(await pool.totalSupply(), toWei('10'))
      })
    })
  
    describe('send()', () => {
      it('should send tokens to another user', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        await pool.send(user2, toWei('10'), [])
        assert.equal(await pool.balanceOf(owner), toWei('0'))
        assert.equal(await pool.balanceOf(user2), toWei('10'))
      })
  
      it('should revert if sending to the burner address', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        let failed = false
        try {
          await pool.send(ZERO_ADDRESS, toWei('10'), [])
        } catch (e) {
          failed = true
        }
        assert.ok(failed, "successfully failed")
      })
  
      it('should work if sending zero', async () => {
        await pool.send(user2, toWei('0'), [])
        assert.equal(await pool.balanceOf(owner), toWei('0'))
        assert.equal(await pool.balanceOf(user2), toWei('0'))
      })
  
      describe('when sender has IERC777Sender interface', () => {
        let sender
        
        beforeEach(async () => {
          sender = await MockERC777Sender.new()
          console.log(owner, TOKENS_SENDER_INTERFACE_HASH, sender.address)
          assert.equal(await registry.getManager(owner), owner)
          await registry.setInterfaceImplementer(owner, TOKENS_SENDER_INTERFACE_HASH, sender.address)
        })
  
        it('should call the interface', async () => {
          await poolContext.depositPool(toWei('10'))
          await poolContext.nextDraw()
          await pool.send(user2, toWei('10'), [])
          assert.equal(await sender.count(), '1')
        })
      })
  
      describe('when recipient has IERC777Recipient interface', () => {
        let recipient
        
        beforeEach(async () => {
          recipient = await MockERC777Recipient.new()
          console.log(owner, TOKENS_RECIPIENT_INTERFACE_HASH, recipient.address)
          await registry.setInterfaceImplementer(user2, TOKENS_RECIPIENT_INTERFACE_HASH, recipient.address, { from: user2 })
        })
  
        it('should call the interface', async () => {
          await poolContext.depositPool(toWei('10'))
          await poolContext.nextDraw()
          await pool.send(user2, toWei('10'), [])
          assert.equal(await recipient.count(), '1')
        })
      })
    })
  
    describe('transfer()', () => {
      it('should transfer tokens to another user', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        await pool.transfer(user2, toWei('10'))
        assert.equal(await pool.balanceOf(owner), toWei('0'))
        assert.equal(await pool.balanceOf(user2), toWei('10'))
      })
  
      it('should revert if transferring to the burner address', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        let failed = false
        try {
          await pool.transfer(ZERO_ADDRESS, toWei('10'))
        } catch (e) {
          failed = true
        }
        assert.ok(failed, "successfully failed")
      })
  
      it('should work if transferring zero', async () => {
        await pool.transfer(user2, toWei('0'))
        assert.equal(await pool.balanceOf(owner), toWei('0'))
        assert.equal(await pool.balanceOf(user2), toWei('0'))
      })
    })
  
    describe('burn()', () => {
      it('should be okay to burn nothing', async () => {
        await pool.burn('0', [])
      })
  
      it('should allow a user to burn some of their tokens', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        let beforeBalance = await token.balanceOf(owner)
        await pool.burn(toWei('10'), [])
        assert.equal(await pool.balanceOf(owner), toWei('0'))
        let afterBalance = await token.balanceOf(owner)
  
        assert.equal(afterBalance, beforeBalance.add(new BN(toWei('10'))).toString())
      })
    })
  
    describe('isOperatorFor()', () => {
      it('should be that a user is an operator for themselves', async () => {
        assert.ok(await pool.isOperatorFor(owner, owner))
      })
  
      it('should be false when a non-operator is checked', async () => {
        assert.ok(!(await pool.isOperatorFor(owner, user1)))
      })
  
      it('should be true when someone is added as an operator', async () => {
        await pool.authorizeOperator(user1)
        assert.ok(await pool.isOperatorFor(user1, owner))
      })
    })
  
    describe('authorizeOperator()', () => {
      it('should allow someone to add an operator', async () => {
        await pool.authorizeOperator(user1)
        assert.ok(await pool.isOperatorFor(user1, owner))
      })
  
      it('should not allow someone to add themselves', async () => {
        let failed = false
        try {
          await pool.authorizeOperator(owner)
        } catch (e) {
          failed = true
        }
        assert.ok(failed, "was able to add self as operator")
      })
    })
  
    describe('revokeOperator()', () => {
      it('should allow someone to revoke an operator', async () => {
        await pool.authorizeOperator(user1)
        assert.ok(await pool.isOperatorFor(user1, owner))
        await pool.revokeOperator(user1)
        assert.ok(!(await pool.isOperatorFor(user1, owner)))
      })
  
      it('should not allow someone to revoke themselves', async () => {
        let failed = false
        try {
          await pool.revokeOperator(owner)
        } catch (e) {
          failed = true
        }
        assert.ok(failed, "was able to revoke self as operator")
      })
    })
  
    describe('defaultOperators()', () => {
      it('should be an empty array', async () => {
        assert.deepEqual(await pool.defaultOperators(), [])
      })
    })
  
    describe('operatorSend()', () => {
      it('should allow an operator to send tokens on behalf of another user', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        await pool.authorizeOperator(user1)
        await pool.operatorSend(owner, user2, toWei('10'), [], [], { from: user1 })
        assert.equal(await pool.balanceOf(owner), toWei('0'))
        assert.equal(await pool.balanceOf(user2), toWei('10'))
      })
    })
  
    describe('operatorBurn()', () => {
      it('should allow an operator to burn someones tokens', async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
        await pool.authorizeOperator(user1)
        let beforeBalance = await token.balanceOf(owner)
        await pool.operatorBurn(owner, toWei('10'), [], [], { from: user1 })
        assert.equal(await pool.balanceOf(owner), toWei('0'))
        let afterBalance = await token.balanceOf(owner)
  
        assert.equal(afterBalance, beforeBalance.add(new BN(toWei('10'))).toString())
      })
    })
  
    describe('allowance() & approve()', () => {
      it('should return the number of tokens that are approved to spend', async () => {
        await pool.approve(user1, toWei('5'))
        assert.equal(await pool.allowance(owner, user1), toWei('5'))
      })
    })
  
    describe('transferFrom()', () => {
      beforeEach(async () => {
        await poolContext.depositPool(toWei('10'))
        await poolContext.nextDraw()
      })
  
      it('should allow a spender to transfer tokens', async () => {
        await pool.approve(user1, toWei('5'))
  
        await pool.transferFrom(owner, user2, toWei('5'), { from: user1 })
  
        assert.equal(await pool.balanceOf(owner), toWei('5'))
        assert.equal(await pool.balanceOf(user2), toWei('5'))
  
        // they have consumed their allowance
        assert.equal(await pool.allowance(owner, user1), '0')
      })
  
      it('should fail if a spender tries to spend more than their allowance', async () => {
        await pool.approve(user1, toWei('5'))
  
        let failed = false
        try {
          await pool.transferFrom(owner, user2, toWei('10'), { from: user1 })
        } catch (e) {
          failed = true
        }
  
        assert.ok(failed, "was able to transfer beyond allowance")
      })
    })
  })
})
