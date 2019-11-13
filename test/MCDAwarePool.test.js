const PoolContext = require('./helpers/PoolContext')
const toWei = require('./helpers/toWei')
const BN = require('bn.js')

const MockScdMcdMigration = artifacts.require('MockScdMcdMigration.sol')

contract('MCDAwarePool', (accounts) => {
  const [owner, admin, user1, user2] = accounts

  let saiContext = new PoolContext({ web3, artifacts, accounts })
  let daiContext = new PoolContext({ web3, artifacts, accounts })

  let saiPool, sai, daiPool, dai, scdMcdMigration

  beforeEach(async () => {
    feeFraction = new BN('0')
    const saiContracts = await saiContext.init()
    sai = saiContracts.token
    moneyMarket = saiContracts.moneyMarket
    registry = saiContracts.registry
    saiPool = await saiContext.createPool()

    const daiContracts = await daiContext.init()
    dai = daiContracts.token
    daiPool = await daiContext.createPool()

    scdMcdMigration = await MockScdMcdMigration.new(sai.address, dai.address)
    // ensure that migration contract *has* dai
    await dai.mint(scdMcdMigration.address, toWei('10000'))
    // ensure that the mock migration is wired up correctly
    assert.equal(await scdMcdMigration.sai(), sai.address)
    assert.equal(await scdMcdMigration.dai(), dai.address)


    await daiPool.initLocalMCDAwarePool(scdMcdMigration.address)
    // Ensure the dai pool has the ScdMcdMigration wired up correctly
    assert.equal(await daiPool.scdMcdMigration(), scdMcdMigration.address)
    assert.equal((await daiPool.methods['sai()'].call()).toString(), sai.address)
    assert.equal((await daiPool.methods['dai()'].call()).toString(), dai.address)
  })

  describe('tokensReceived()', () => {
    const amount = toWei('10')

    describe('when transferring Pool Sai to Dai Pool', () => {
      beforeEach(async () => {
        // ensure user has Pool Sai to transfer
        await saiContext.depositPool(amount)
        await saiContext.nextDraw()
      })

      describe('when the dai pool has a committed draw', async () => {
        beforeEach(async () => {
          // roll over to next draw so we have a committed draw
          await daiContext.nextDraw()
        })

        it('should migrate the sai to dai and immediately have a balance', async () => {
          await saiPool.transfer(daiPool.address, amount)

          assert.equal(await saiPool.balanceOf(owner), '0')
          assert.equal(await daiPool.balanceOf(owner), toWei('10'))
        })
      })

      it('should migrate the sai to dai and deposit', async () => {
        await saiPool.transfer(daiPool.address, amount)

        assert.equal(await saiPool.balanceOf(owner), '0')
        assert.equal(await daiPool.balanceOf(owner), '0')
        assert.equal(await daiPool.openBalanceOf(owner), toWei('10'))
      })
    })
  })
})
