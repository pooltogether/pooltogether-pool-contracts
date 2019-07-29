const toWei = require('./helpers/toWei')
const BN = require('bn.js')
const Token = artifacts.require('Token.sol')
const Pool = artifacts.require('Pool.sol')
const CErc20Mock = artifacts.require('CErc20Mock.sol')
const FixidityLib = artifacts.require('FixidityLib.sol')
const SortitionSumTreeFactory = artifacts.require('SortitionSumTreeFactory.sol')
const DrawManager = artifacts.require('DrawManager.sol')

const nextDrawDebug = require('debug')('Pool.test.js:nextDraw')

contract('Pool', (accounts) => {
  let pool, token, moneyMarket, sumTree, drawManager
  
  let [owner, admin, user1, user2] = accounts

  let ticketPrice = new BN(web3.utils.toWei('10', 'ether'))
  // let feeFraction = new BN('5' + zero_22) // equal to 0.05
  let feeFraction = new BN('0')

  let secret = '0x1234123412341234123412341234123412341234123412341234123412341234'
  let secretHash = web3.utils.soliditySha3(secret)

  const priceForTenTickets = ticketPrice.mul(new BN(10))

  let supplyRateMantissa = '100000000000000000' // 0.1 per block

  let Rewarded, Committed

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

  async function createPool() {
    await Pool.link("DrawManager", drawManager.address)
    await Pool.link("FixidityLib", fixidity.address)

    pool = await Pool.new()
    await pool.init(
      owner,
      moneyMarket.address,
      feeFraction,
      owner
    )

    await pool.openNextDraw(secretHash)

    return pool
  }

  async function nextDraw(options) {
    let logs
    Rewarded = undefined
    Committed = undefined

    const currentDrawId = await pool.currentCommittedDrawId()

    if (currentDrawId.toString() === '0') {
      logs = (await pool.openNextDraw(secretHash)).logs
      Committed = logs[0]
    } else {
      if (options) {
        logs = (await pool.rewardAndOpenNextDraw(secretHash, secret, options)).logs;
      } else {
        logs = (await pool.rewardAndOpenNextDraw(secretHash, secret)).logs;
      }
  
      nextDrawDebug('rewardAndOpenNextDraw: ', logs)
      Rewarded = logs[0]
      assert.equal(Rewarded.event, 'Rewarded')
      Committed = logs[1]
      assert.equal(Committed.event, 'Committed')  
    }
  }

  async function printDrawIds() {
    const rewardId = await pool.currentRewardedDrawId()
    const commitId = await pool.currentCommittedDrawId()
    const openId = await pool.currentOpenDrawId()
    console.log({ rewardId, commitId, openId })
  }

  describe('supplyRateMantissa()', () => {
    it('should work', async () => {
      pool = await createPool() // ten blocks long
      assert.equal(await pool.supplyRateMantissa(), web3.utils.toWei('0.1', 'ether'))
    })
  })

  describe('currentInterestFractionFixedPoint24()', () => {
    it('should return the right value', async () => {
      pool = await createPool() // ten blocks long
      const interestFraction = await pool.currentInterestFractionFixedPoint24(10)
      assert.equal(interestFraction.toString(), web3.utils.toWei('1000000', 'ether'))
    })
  })

  describe('maxPoolSize()', () => {
    it('should set an appropriate limit based on max integers', async () => {
      pool = await createPool() // ten blocks long
      const limit = await fixidity.newFixed(new BN('1000'))
      const maxSize = await pool.maxPoolSizeFixedPoint24(10, limit);
      const poolLimit = new BN('333333333333333333333333000')
      assert.equal(maxSize.toString(), poolLimit.toString())
    })
  })

  describe('with a fresh pool', () => {
    beforeEach(async () => {
      pool = await createPool()
    })

    describe('depositPool()', () => {
      it('should fail if not enough tokens approved', async () => {
        await token.approve(pool.address, ticketPrice.div(new BN(2)), { from: user1 })

        let failed
        try {
          await pool.depositPool(ticketPrice, { from: user1 })
          failed = false
        } catch (error) {
          failed = true
        }
        assert.ok(failed, "was able to deposit less than the minimum")
      })

      it('should deposit some tokens into the pool', async () => {
        await token.approve(pool.address, ticketPrice, { from: user1 })

        const response = await pool.depositPool(ticketPrice, { from: user1 })
        const deposited = response.receipt.logs[0]
        assert.equal(deposited.event, 'Deposited')
        assert.equal(deposited.address, pool.address)
        assert.equal(deposited.args[0], user1)
        assert.equal(deposited.args[1].toString(), toWei('10'))
      })

      it('should allow multiple deposits', async () => {
        await token.approve(pool.address, ticketPrice, { from: user1 })

        await pool.depositPool(ticketPrice, { from: user1 })

        await token.approve(pool.address, ticketPrice, { from: user1 })
        await pool.depositPool(ticketPrice, { from: user1 })

        const amount = await pool.balanceOf(user1)
        assert.equal(amount.toString(), ticketPrice.mul(new BN(2)).toString())
      })
    })

    describe('depositSponsorship()', () => {
      beforeEach(async () => {
        await token.approve(pool.address, ticketPrice, { from: user1 })
        await pool.depositPool(ticketPrice, { from: user1 })
      })

      it('should contribute to the winnings', async () => {
        await nextDraw()

        // console.log('checkpoint 1')
        await token.approve(pool.address, toWei('1000'), { from: user2 })
        // console.log('checkpoint 2')
        await pool.depositSponsorship(toWei('1000'), { from: user2 })
        
        // Sponsor has no pool balance
        assert.equal((await pool.balanceOf(user2)).toString(), toWei('0'))

        // Sponsor has a sponsorship balance
        assert.equal((await pool.balanceOfSponsorship(user2)).toString(), toWei('1000'))

        await nextDraw()

        assert.equal(Rewarded.event, 'Rewarded')
        assert.equal(Rewarded.args.winner, user1)

        // User's winnings include interest from the sponsorship
        assert.equal(Rewarded.args.winnings.toString(), toWei('202'))

        // User's balance includes their winnings and the ticket price
        assert.equal((await pool.balanceOf(user1)).toString(), toWei('212'))
      })
    })

    describe('withdrawSponsorship()', () => {
      beforeEach(async () => {
        await token.approve(pool.address, toWei('1000'), { from: user2 })
        await pool.depositSponsorship(toWei('1000'), { from: user2 })
      })

      it('should allow the sponsor to withdraw partially', async () => {
        const user2BalanceBefore = await token.balanceOf(user2)

        await pool.withdrawSponsorship(toWei('500'), { from: user2 })

        assert.equal((await pool.balanceOfSponsorship(user2)).toString(), toWei('500'))
        const user2BalanceAfter = await token.balanceOf(user2)
        assert.equal(user2BalanceAfter.toString(), user2BalanceBefore.add(new BN(toWei('500'))).toString())
      })
    })

    describe('withdrawPool()', () => {
      it('should work for one participant', async () => {
        await token.approve(pool.address, ticketPrice, { from: user1 })
        await pool.depositPool(ticketPrice, { from: user1 })
        await nextDraw()
        await nextDraw()

        let balance = await pool.balanceOf(user1)
        assert.equal(balance.toString(), toWei('12'))

        const balanceBefore = await token.balanceOf(user1)
        await pool.withdrawPool({ from: user1 })
        const balanceAfter = await token.balanceOf(user1)

        assert.equal(balanceAfter.toString(), (new BN(balanceBefore).add(balance)).toString())
      })

      it('should work for two participants', async () => {

        await token.approve(pool.address, priceForTenTickets, { from: user1 })
        await pool.depositPool(priceForTenTickets, { from: user1 })

        await token.approve(pool.address, priceForTenTickets, { from: user2 })
        await pool.depositPool(priceForTenTickets, { from: user2 })

        await nextDraw()

        assert.equal((await pool.eligibleSupply()).toString(), toWei('200'))

        await nextDraw()
        
        const user1BalanceBefore = await token.balanceOf(user1)
        await pool.withdrawPool({ from: user1 })
        const user1BalanceAfter = await token.balanceOf(user1)

        const user2BalanceBefore = await token.balanceOf(user2)        
        await pool.withdrawPool({ from: user2 })
        const user2BalanceAfter = await token.balanceOf(user2)

        const earnedInterest = priceForTenTickets.mul(new BN(2)).mul(new BN(20)).div(new BN(100))

        if (Rewarded.args.winner === user1) {
          assert.equal(user2BalanceAfter.toString(), (new BN(user2BalanceBefore).add(priceForTenTickets)).toString())
          assert.equal(user1BalanceAfter.toString(), (new BN(user1BalanceBefore).add(priceForTenTickets.add(earnedInterest))).toString())
        } else if (Rewarded.args.winner === user2) {
          assert.equal(user2BalanceAfter.toString(), (new BN(user2BalanceBefore).add(priceForTenTickets.add(earnedInterest))).toString())
          assert.equal(user1BalanceAfter.toString(), (new BN(user1BalanceBefore).add(priceForTenTickets)).toString())
        } else {
          throw new Error(`Unknown winner: ${info.winner}`)
        }
      })

      it('should work when one user withdraws before the next draw', async () => {
        await token.approve(pool.address, priceForTenTickets, { from: user1 })
        await pool.depositPool(priceForTenTickets, { from: user1 })

        await token.approve(pool.address, priceForTenTickets, { from: user2 })
        await pool.depositPool(priceForTenTickets, { from: user2 })

        await nextDraw()

        // pool is now committed and earning interest
        await pool.withdrawPool({ from: user2 })

        await nextDraw()

        // pool has been rewarded
        // earned interest will only be 20% of user1's ticket balance
        const earnedInterest = priceForTenTickets.mul(new BN(20)).div(new BN(100))

        assert.equal(Rewarded.args.winner, user1)
        assert.equal((await pool.balanceOf(user1)).toString(), earnedInterest.add(priceForTenTickets).toString())
      })
    })

    describe('balanceOf()', () => {
      it('should return the entrants total to withdraw', async () => {
        await token.approve(pool.address, ticketPrice, { from: user1 })
        await pool.depositPool(ticketPrice, { from: user1 })

        let balance = await pool.balanceOf(user1)

        assert.equal(balance.toString(), ticketPrice.toString())
      })
    })
  })

  describe('when fee fraction is greater than zero', () => {
    beforeEach(() => {
      /// Fee fraction is 10%
      feeFraction = web3.utils.toWei('0.1', 'ether')
    })

    it('should reward the owner the fee', async () => {

      await createPool()

      const user1Tickets = ticketPrice.mul(new BN(100))
      await token.approve(pool.address, user1Tickets, { from: user1 })
      await pool.depositPool(user1Tickets, { from: user1 })

      await nextDraw()

      /// CErc20Mock awards 20% regardless of duration.
      const totalDeposit = user1Tickets
      const interestEarned = totalDeposit.mul(new BN(20)).div(new BN(100))
      const fee = interestEarned.mul(new BN(10)).div(new BN(100))

      // we expect unlocking to transfer the fee to the owner
      await nextDraw()

      assert.equal(Rewarded.args.fee.toString(), fee.toString())

      assert.equal((await pool.balanceOf(owner)).toString(), fee.toString())

      // we expect the pool winner to receive the interest less the fee
      const user1Balance = await token.balanceOf(user1)
      await pool.withdrawPool({ from: user1 })
      const newUser1Balance = await token.balanceOf(user1)
      assert.equal(newUser1Balance.toString(), user1Balance.add(user1Tickets).add(interestEarned).sub(fee).toString())
    })
  })

  describe('setNextFeeBeneficiary()', () => {
    beforeEach(async () => {
      await createPool()
    })

    it('should allow an admin to change the beneficiary', async () => {
      
    })
  })
})
