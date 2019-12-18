const PoolContext = require('./helpers/PoolContext')
const toWei = require('./helpers/toWei')
const chai = require('./helpers/chai')
const {
  ERC_777_INTERFACE_HASH,
  ERC_20_INTERFACE_HASH,
  TOKENS_RECIPIENT_INTERFACE_HASH
} = require('./helpers/constants')

const BN = require('bn.js')

const MockScdMcdMigration = artifacts.require('MockScdMcdMigration.sol')
const ERC777Mintable = artifacts.require('ERC777Mintable.sol')

contract('MCDAwarePool', (accounts) => {
  const [owner, admin, user1, user2] = accounts

  let sendingContext = new PoolContext({ web3, artifacts, accounts })
  let receivingContext = new PoolContext({ web3, artifacts, accounts })

  let receivingPool, dai, receivingContracts

  beforeEach(async () => {
    receivingContracts = await receivingContext.init()
    dai = receivingContracts.token
    receivingPool = await receivingContext.createPool()
  })

  describe('tokensReceived()', () => {
    const amount = toWei('10')

    describe('from ERC777', () => {
      let token

      beforeEach(async () => {
        token = await ERC777Mintable.new()
        await token.initialize('toke', 'TK', [])
      })

      it('should fail', async () => {
        await token.mint(owner, toWei('1000'), [])

        await chai.assert.isRejected(token.send(receivingPool.address, toWei('1000'), []), /can only receive tokens from Sai Pool Token/)
      })
    })

    describe('from an MCDAwarePool', () => {
      let sendingPool, sai, scdMcdMigration

      beforeEach(async () => {
        // Create sending MCDAwarePool
        const sendingContracts = await sendingContext.init()
        sai = sendingContracts.token
        moneyMarket = sendingContracts.moneyMarket
        registry = sendingContracts.registry
        sendingPool = await sendingContext.createPool()
        sendingToken = await sendingContext.createToken()

        // ensure user has Pool Sai to transfer
        await sendingContext.depositPool(amount)
        await sendingContext.nextDraw()

        // Create Maker SCD MCD Migration contract
        scdMcdMigration = await MockScdMcdMigration.new(sai.address, dai.address)
        // ensure that migration contract *has* dai
        await dai.mint(scdMcdMigration.address, toWei('10000'))
        // ensure that the mock migration is wired up correctly
        assert.equal(await scdMcdMigration.sai(), sai.address)
        assert.equal(await scdMcdMigration.dai(), dai.address)

        // Inject SCDMCDMigration into receiving pool
        await receivingPool.initLocalMCDAwarePool(scdMcdMigration.address, sendingPool.address)
        // Ensure the dai pool has the ScdMcdMigration wired up correctly
        assert.equal(await receivingPool.scdMcdMigration(), scdMcdMigration.address)
        assert.equal((await receivingPool.methods['sai()'].call()).toString(), sai.address)
        assert.equal((await receivingPool.methods['dai()'].call()).toString(), dai.address)
      })

      describe('when the dai pool has a committed draw', async () => {
        beforeEach(async () => {
          // roll over to next draw so we have a committed draw
          await receivingContext.nextDraw()
        })

        it('should migrate the sai to dai and immediately have a balance', async () => {
          await sendingToken.transfer(receivingPool.address, amount)

          assert.equal(await sendingPool.balanceOf(owner), '0')
          assert.equal(await receivingPool.balanceOf(owner), toWei('10'))
        })
      })

      it('should migrate the sai to dai and deposit', async () => {
        await sendingToken.transfer(receivingPool.address, amount)

        assert.equal(await sendingPool.balanceOf(owner), '0')
        assert.equal(await receivingPool.balanceOf(owner), '0')
        assert.equal(await receivingPool.openBalanceOf(owner), toWei('10'))
      })

      describe('when paused', async () => {
        beforeEach(async () => {
          await receivingPool.pause()
        })

        it('should reject the migration', async () => {
          await chai.assert.isRejected(sendingToken.transfer(receivingPool.address, amount), /contract is paused/)
        })
      })

      describe('to a non-Dai MCD Pool', () => {
        let newDaiToken

        beforeEach(async () => {
          newDaiToken = await sendingContext.newToken()
          await scdMcdMigration.setDai(newDaiToken.address)
        })

        it('should reject the transfer', async () => {
          await chai.assert.isRejected(sendingToken.transfer(receivingPool.address, amount), /contract does not use Dai/)
        })
      })
    })
  })

  describe('initMCDAwarePool()', () => {
    it('should init the MCDAwarePool', async () => {
      pool = await receivingContext.newPool()
      
      await pool.initMCDAwarePool()

      assert.equal(await receivingContracts.registry.getInterfaceImplementer(pool.address, TOKENS_RECIPIENT_INTERFACE_HASH), pool.address)
      assert.equal(await pool.lockDuration(), '40')
      assert.equal(await pool.cooldownDuration(), '80')
    })
  })
})
