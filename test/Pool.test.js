const BN = require('bn.js')
const Token = artifacts.require('Token.sol')
const Pool = artifacts.require('Pool.sol')
const CErc20Mock = artifacts.require('CErc20Mock.sol')
const FixidityLib = artifacts.require('FixidityLib.sol')
const SortitionSumTreeFactory = artifacts.require('SortitionSumTreeFactory.sol')
const DrawManager = artifacts.require('DrawManager.sol')
const mineBlocks = require('./helpers/mineBlocks')

contract('Pool', (accounts) => {
  let pool, token, moneyMarket, sumTree, drawManager
  
  const blocksPerMinute = 5

  let [owner, admin, user1, user2] = accounts

  let ticketPrice = new BN(web3.utils.toWei('10', 'ether'))
  // let feeFraction = new BN('5' + zero_22) // equal to 0.05
  let feeFraction = new BN('0')

  const priceForTenTickets = ticketPrice.mul(new BN(10))

  let secret = '0x1234123412341234123412341234123412341234123412341234123412341234'
  let secretHash = web3.utils.soliditySha3(secret)
  let supplyRateMantissa = '100000000000000000' // 0.1 per block

  beforeEach(async () => {
    sumTree = await SortitionSumTreeFactory.new()
    await DrawManager.link("SortitionSumTreeFactory", sumTree.address)
    drawManager = await DrawManager.new()
    await Pool.link('DrawManager', drawManager.address)
    fixidity = await FixidityLib.new({ from: admin })

    token = await Token.new({ from: admin })
    await token.initialize(owner)

    moneyMarket = await CErc20Mock.new({ from: admin })
    await moneyMarket.initialize(token.address, new BN(supplyRateMantissa))

    await token.mint(moneyMarket.address, web3.utils.toWei('10000000', 'ether'))
    await token.mint(user1, web3.utils.toWei('100000', 'ether'))
    await token.mint(user2, web3.utils.toWei('100000', 'ether'))
  })

  async function createPool(lockStartBlock = -1, lockEndBlock = 0, allowLockAnytime = true) {
    const block = await blockNumber()

    await Pool.link("DrawManager", drawManager.address)
    await Pool.link("FixidityLib", fixidity.address)

    const pool = await Pool.new(
      moneyMarket.address,
      token.address,
      block + lockStartBlock,
      block + lockEndBlock,
      ticketPrice,
      feeFraction,
      allowLockAnytime
    )
    pool.initialize(owner)
    return pool
  }

  async function blockNumber() {
    return await web3.eth.getBlockNumber()
  }

  describe('supplyRateMantissa()', () => {
    it('should work', async () => {
      pool = await createPool(0, 10) // ten blocks long
      assert.equal(await pool.supplyRateMantissa(), web3.utils.toWei('0.1', 'ether'))
    })
  })

  describe('currentInterestFractionFixedPoint24()', () => {
    it('should return the right value', async () => {
      pool = await createPool(0, 10) // ten blocks long
      const interestFraction = await pool.currentInterestFractionFixedPoint24()
      assert.equal(interestFraction.toString(), web3.utils.toWei('1000000', 'ether'))
    })
  })

  describe('maxPoolSize()', () => {
    it('should set an appropriate limit based on max integers', async () => {
      pool = await createPool(0, 10) // ten blocks long
      const limit = await fixidity.newFixed(new BN('1000'))
      const maxSize = await pool.maxPoolSizeFixedPoint24(limit);
      const poolLimit = new BN('333333333333333333333333000')
      assert.equal(maxSize.toString(), poolLimit.toString())
    })
  })

  describe('pool that is still open and must respect block start and end', () => {
    beforeEach(async () => {
      pool = await createPool(9, 10, false)
    })

    describe('lock()', () => {
      it('cannot be locked before the open duration is over', async () => {
        let failed = false
        try {
          await pool.lock(secretHash)
        } catch (error) {
          failed = true
        }
        assert.ok(failed, "pool should not have been able to lock()")
      })
    })
  })

  describe('pool that is still during the lock period', () => {
    beforeEach(async () => {
      pool = await createPool(-10, 10, false)
    })

    describe('complete(secret)', () => {
      it('cannot be unlocked before the lock duration ends', async () => {
        await pool.lock(secretHash)
        let failed = false
        try {
          await pool.complete(secret)
        } catch (error) {
          failed = true
        }
        assert.ok(failed, "pool should not have been able to lock()")
      })
    })
  })

  describe('pool with zero open and lock durations', () => {
    beforeEach(async () => {
      pool = await createPool()
    })

    describe('buyTicket()', () => {
      it('should fail if not enough tokens approved', async () => {
        await token.approve(pool.address, ticketPrice.div(new BN(2)), { from: user1 })

        let failed
        try {
          await pool.buyTickets(1, { from: user1 })
          failed = false
        } catch (error) {
          failed = true
        }
        assert.ok(failed, "was able to deposit less than the minimum")
      })

      it('should deposit some tokens into the pool', async () => {
        await token.approve(pool.address, ticketPrice, { from: user1 })

        const response = await pool.buyTickets(1, { from: user1 })
        const boughtTicketsEvent = response.receipt.logs[0]
        assert.equal(boughtTicketsEvent.event, 'BoughtTickets')
        assert.equal(boughtTicketsEvent.address, pool.address)
        assert.equal(boughtTicketsEvent.args[0], user1)
        assert.equal(boughtTicketsEvent.args[1].toString(), '1')
        assert.equal(boughtTicketsEvent.args[2].toString(), ticketPrice.toString())
      })

      it('should allow multiple deposits', async () => {
        await token.approve(pool.address, ticketPrice, { from: user1 })

        await pool.buyTickets(1, { from: user1 })

        await token.approve(pool.address, ticketPrice, { from: user1 })
        await pool.buyTickets(1, { from: user1 })

        const response = await pool.getEntry(user1)
        assert.equal(response.addr, user1)
        assert.equal(response.amount.toString(), ticketPrice.mul(new BN(2)).toString())
        assert.equal(response.ticketCount.toString(), '2')
      })
    })

    describe('getEntry()', () => {
      it('should return zero when there are no entries', async () => {
        let entry = await pool.getEntry('0x0000000000000000000000000000000000000000')
        assert.equal(entry.amount, '0')
      })
    })

    describe('lock()', () => {
      it('should transfer tokens to the money market', async () => {
        await token.approve(pool.address, ticketPrice, { from: user1 })
        await pool.buyTickets(1, { from: user1 })
        await pool.lock(secretHash)
      })
    })

    describe('unlock()', () => {
      beforeEach(async () => {
        await token.approve(pool.address, ticketPrice, { from: user1 })
        await pool.buyTickets(1, { from: user1 })
        await pool.lock(secretHash)
      })

      it('should not have a winner until the Pool is complete', async () => {
        assert.equal(await pool.winnerAddress(), '0x0000000000000000000000000000000000000000')
      })

      it('should allow anyone to unlock the pool', async () => {
        await pool.unlock({ from: user1 })
      })

      it('should allow the owner to unlock the pool', async () => {
        await pool.unlock()
      })

      describe('withdraw() after unlock', () => {
        beforeEach(async () => {
          await pool.unlock({ from: user1 })
        })

        it('should allow users to withdraw after the pool is unlocked', async () => {
          let poolBalance = await pool.balanceOf(user1)
          assert.equal(poolBalance.toString(), ticketPrice.toString())

          let balanceBefore = await token.balanceOf(user1)
          await pool.withdraw({ from: user1 })
          let balanceAfter = await token.balanceOf(user1)
          let balanceDifference = new BN(balanceAfter).sub(new BN(balanceBefore))
          assert.equal(balanceDifference.toString(), ticketPrice.toString())

          poolBalance = await pool.balanceOf(user1)
          assert.equal(poolBalance.toString(), '0')

          await pool.complete(secret)
          let netWinnings = await pool.netWinnings()

          poolBalance = await pool.balanceOf(user1)
          assert.equal(poolBalance.toString(), netWinnings.toString())

          balanceBefore = await token.balanceOf(user1)
          await pool.withdraw({ from: user1 })
          balanceAfter = await token.balanceOf(user1)
          balanceDifference = new BN(balanceAfter).sub(new BN(balanceBefore))
          assert.equal(balanceDifference.toString(), netWinnings.toString())
        })
      })
    })

    describe('complete(secret)', () => {
      describe('with one user', () => {
        beforeEach(async () => {
          await token.approve(pool.address, ticketPrice, { from: user1 })
          await pool.buyTickets(1, { from: user1 })
          await pool.lock(secretHash)
          await pool.complete(secret)
        })

        it('should select a winner and transfer tokens from money market back', async () => {
          const info = await pool.getInfo()
          assert.equal(info.supplyBalanceTotal.toString(), web3.utils.toWei('12', 'ether'))
          assert.equal(info.winner, user1)
        })
      })

      describe('with two users', () => {
        beforeEach(async () => {
          await token.approve(pool.address, priceForTenTickets, { from: user1 })
          await pool.buyTickets(10, { from: user1 })

          await token.approve(pool.address, priceForTenTickets, { from: user2 })
          await pool.buyTickets(10, { from: user2 })

          await pool.lock(secretHash)
          await pool.complete(secret)
        })

        it('should not change the winner if time moves forward', async () => {
          const originalWinner = await pool.winnerAddress()

          await mineBlocks(256)

          for (let i = 0; i < 10; i++) {
            await mineBlocks(1)
            const newWinner = await pool.winnerAddress()
            assert.equal(newWinner.toString(), originalWinner.toString(), `Comparison failed at iteration ${i}`)
          }
        })
      })

      it('should succeed even without a balance', async () => {
        await pool.lock(secretHash)
        await pool.complete(secret)
        const info = await pool.getInfo()
        assert.equal(info.winner, '0x0000000000000000000000000000000000000000')
      })
    })

    describe('withdraw()', () => {
      it('should work for one participant', async () => {
        await token.approve(pool.address, ticketPrice, { from: user1 })
        await pool.buyTickets(1, { from: user1 })
        await pool.lock(secretHash)
        await pool.complete(secret)

        let winnings = await pool.winnings(user1)
        let winningBalance = new BN(web3.utils.toWei('12', 'ether'))
        assert.equal(winnings.toString(), winningBalance.toString())

        const balanceBefore = await token.balanceOf(user1)
        await pool.withdraw({ from: user1 })
        const balanceAfter = await token.balanceOf(user1)

        assert.equal(balanceAfter.toString(), (new BN(balanceBefore).add(winningBalance)).toString())
      })

      it('should work for two participants', async () => {

        await token.approve(pool.address, priceForTenTickets, { from: user1 })
        await pool.buyTickets(10, { from: user1 })

        await token.approve(pool.address, priceForTenTickets, { from: user2 })
        await pool.buyTickets(10, { from: user2 })

        await pool.lock(secretHash)
        await pool.complete(secret)
        const info = await pool.getInfo()

        const user1BalanceBefore = await token.balanceOf(user1)
        await pool.withdraw({ from: user1 })
        const user1BalanceAfter = await token.balanceOf(user1)

        const user2BalanceBefore = await token.balanceOf(user2)
        await pool.withdraw({ from: user2 })
        const user2BalanceAfter = await token.balanceOf(user2)

        const earnedInterest = priceForTenTickets.mul(new BN(2)).mul(new BN(20)).div(new BN(100))

        if (info.winner === user1) {
          assert.equal(user2BalanceAfter.toString(), (new BN(user2BalanceBefore).add(priceForTenTickets)).toString())
          assert.equal(user1BalanceAfter.toString(), (new BN(user1BalanceBefore).add(priceForTenTickets.add(earnedInterest))).toString())
        } else if (info.winner === user2) {
          assert.equal(user2BalanceAfter.toString(), (new BN(user2BalanceBefore).add(priceForTenTickets.add(earnedInterest))).toString())
          assert.equal(user1BalanceAfter.toString(), (new BN(user1BalanceBefore).add(priceForTenTickets)).toString())
        } else {
          throw new Error(`Unknown winner: ${info.winner}`)
        }
      })
    })

    describe('winnings()', () => {
      it('should return the entrants total to withdraw', async () => {
        await token.approve(pool.address, ticketPrice, { from: user1 })
        await pool.buyTickets(1, { from: user1 })

        let winnings = await pool.winnings(user1)

        assert.equal(winnings.toString(), ticketPrice.toString())
      })
    })
  })

  describe('when pool cannot be locked yet', () => {
    beforeEach(async () => {
      // one thousand seconds into future
      const lockStartBlock = 15 * blocksPerMinute
      const lockEndBlock = lockStartBlock + 15 * blocksPerMinute
      pool = await createPool(lockStartBlock, lockEndBlock)
    })

    describe('lock()', () => {
      beforeEach(async () => {
        await token.approve(pool.address, ticketPrice, { from: user1 })
        await pool.buyTickets(1, { from: user1 })
      })

      it('should not work for regular users', async () => {
        let failed
        try {
          await pool.lock({ from: user1 })
          failed = false
        } catch (error) {
          failed = true
        }

        assert.ok(failed, "pool should not have locked")
      })

      it('should support early locking by the owner', async () => {
        await pool.lock(secretHash, { from: owner })
      })
    })
  })

  describe('when pool cannot be unlocked yet', () => {
    beforeEach(async () => {

      // in the past
      let lockStartBlock = -10

      // in the future
      let lockEndBlock = 15 * blocksPerMinute

      pool = await createPool(lockStartBlock, lockEndBlock)
    })

    describe('complete(secret)', () => {
      beforeEach(async () => {
        await token.approve(pool.address, ticketPrice, { from: user1 })
        await pool.buyTickets(1, { from: user1 })
        await pool.lock(secretHash)
      })

      it('should still work for the owner', async () => {
        await pool.complete(secret)
      })

      it('should not work for anyone else', async () => {
        let failed
        try {
          await pool.complete({ from: user1 })
          failed = false
        } catch (error) {
          failed = true
        }
        assert.ok(failed, "call did not fail")
      })
    })
  })

  describe('when fee fraction is greater than zero', () => {
    beforeEach(() => {
      /// Fee fraction is 10%
      feeFraction = web3.utils.toWei('0.1', 'ether')
    })

    it('should reward the owner the fee', async () => {

      const pool = await createPool(0, 1)

      const user1Tickets = ticketPrice.mul(new BN(100))
      await token.approve(pool.address, user1Tickets, { from: user1 })
      await pool.buyTickets(100, { from: user1 })

      const ownerBalance = await token.balanceOf(owner)
      await pool.lock(secretHash, { from: owner })

      /// CErc20Mock awards 20% regardless of duration.
      const totalDeposit = user1Tickets
      const interestEarned = totalDeposit.mul(new BN(20)).div(new BN(100))
      const fee = interestEarned.mul(new BN(10)).div(new BN(100))

      // we expect unlocking to transfer the fee to the owner
      await pool.complete(secret, { from: owner })

      assert.equal((await pool.feeAmount()).toString(), fee.toString())

      const newOwnerBalance = await token.balanceOf(owner)
      assert.equal(newOwnerBalance.toString(), ownerBalance.add(fee).toString())

      // we expect the pool winner to receive the interest less the fee
      const user1Balance = await token.balanceOf(user1)
      await pool.withdraw({ from: user1 })
      const newUser1Balance = await token.balanceOf(user1)
      assert.equal(newUser1Balance.toString(), user1Balance.add(user1Tickets).add(interestEarned).sub(fee).toString())
    })
  })

})
