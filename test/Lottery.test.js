const BN = require('bn.js')
const Token = artifacts.require('Token.sol')
const Lottery = artifacts.require('Lottery.sol')
const MoneyMarketMock = artifacts.require('MoneyMarketMock.sol')
const FixidityLib = artifacts.require('FixidityLib.sol')
const SortitionSumTreeFactory = artifacts.require('SortitionSumTreeFactory.sol')

const zero_22 = '0000000000000000000000'

contract('Lottery', (accounts) => {
  let lottery, token, moneyMarket, sumTree
  
  const blocksPerMinute = 5

  let [owner, admin, user1, user2] = accounts

  let ticketPrice = new BN(web3.utils.toWei('10', 'ether'))
  // let feeFraction = new BN('5' + zero_22) // equal to 0.05
  let feeFraction = new BN('0')

  let secret = '0x1234123412341234123412341234123412341234123412341234123412341234'
  let secretHash = web3.utils.soliditySha3(secret)
  let supplyRateMantissa = '100000000000000000' // 0.1 per block

  beforeEach(async () => {
    sumTree = await SortitionSumTreeFactory.new()
    fixidity = await FixidityLib.new({ from: admin })

    token = await Token.new({ from: admin })
    await token.initialize(owner)

    moneyMarket = await MoneyMarketMock.new({ from: admin })
    await moneyMarket.initialize(token.address, new BN(supplyRateMantissa))

    await token.mint(moneyMarket.address, web3.utils.toWei('10000000', 'ether'))
    await token.mint(user1, web3.utils.toWei('100000', 'ether'))
    await token.mint(user2, web3.utils.toWei('100000', 'ether'))
  })

  async function createLottery(bondStartBlock = -1, bondEndBlock = 0) {
    const block = await blockNumber()

    // console.log(
    //   moneyMarket.address.toString(),
    //   token.address.toString(),
    //   (block + bondStartBlock),
    //   (block + bondEndBlock),
    //   ticketPrice.toString(),
    //   feeFraction.toString(),
    //   fixidity.address.toString()
    // )

    await Lottery.link("SortitionSumTreeFactory", sumTree.address)
    await Lottery.link("FixidityLib", fixidity.address)

    const lottery = await Lottery.new(
      moneyMarket.address,
      token.address,
      block + bondStartBlock,
      block + bondEndBlock,
      ticketPrice,
      feeFraction
    )
    lottery.initialize(owner)
    return lottery
  }

  async function blockNumber() {
    return await web3.eth.getBlockNumber()
  }

  describe('supplyRateMantissa()', () => {
    it('should work', async () => {
      lottery = await createLottery(0, 10) // ten blocks long
      assert.equal(await lottery.supplyRateMantissa(), web3.utils.toWei('0.1', 'ether'))
    })
  })

  describe('currentInterestFractionFixedPoint24()', () => {
    it('should return the right value', async () => {
      lottery = await createLottery(0, 10) // ten blocks long
      const interestFraction = await lottery.currentInterestFractionFixedPoint24()
      assert.equal(interestFraction.toString(), web3.utils.toWei('1000000', 'ether'))
    })
  })

  describe('maxLotterySize()', () => {
    it('should set an appropriate limit based on max integers', async () => {
      lottery = await createLottery(0, 10) // ten blocks long
      const limit = await fixidity.newFixed(new BN('1000'))
      const maxSize = await lottery.maxLotterySizeFixedPoint24(limit);
      const lotteryLimit = new BN('333333333333333333333333000')
      assert.equal(maxSize.toString(), lotteryLimit.toString())
    })
  })

  describe('lottery with zero open and bond durations', () => {
    beforeEach(async () => {
      lottery = await createLottery()
    })

    describe('buyTicket()', () => {
      it('should fail if not enough tokens approved', async () => {
        await token.approve(lottery.address, ticketPrice.div(new BN(2)), { from: user1 })

        let failed
        try {
          await lottery.buyTickets(1, { from: user1 })
          failed = false
        } catch (error) {
          failed = true
        }
        assert.ok(failed, "was able to deposit less than the minimum")
      })

      it('should deposit some tokens into the lottery', async () => {
        await token.approve(lottery.address, ticketPrice, { from: user1 })

        const response = await lottery.buyTickets(1, { from: user1 })
        const boughtTicketsEvent = response.receipt.logs[0]
        assert.equal(boughtTicketsEvent.event, 'BoughtTickets')
        assert.equal(boughtTicketsEvent.address, lottery.address)
        assert.equal(boughtTicketsEvent.args[0], user1)
        assert.equal(boughtTicketsEvent.args[1].toString(), '1')
        assert.equal(boughtTicketsEvent.args[2].toString(), ticketPrice.toString())
      })

      it('should allow multiple deposits', async () => {
        await token.approve(lottery.address, ticketPrice, { from: user1 })

        await lottery.buyTickets(1, { from: user1 })

        await token.approve(lottery.address, ticketPrice, { from: user1 })
        await lottery.buyTickets(1, { from: user1 })

        const response = await lottery.getEntry(user1)
        assert.equal(response.addr, user1)
        assert.equal(response.amount.toString(), ticketPrice.mul(new BN(2)).toString())
        assert.equal(response.ticketCount.toString(), '2')
      })
    })

    describe('getEntry()', () => {
      it('should return zero when there are no entries', async () => {
        let entry = await lottery.getEntry('0x0000000000000000000000000000000000000000')
        assert.equal(entry.amount, '0')
      })
    })

    describe('lock()', () => {
      it('should transfer tokens to the money market', async () => {
        await token.approve(lottery.address, ticketPrice, { from: user1 })
        await lottery.buyTickets(1, { from: user1 })
        await lottery.lock(secretHash)
      })
    })

    describe('unlock()', () => {
      it('should transfer tokens from money market back', async () => {
        await token.approve(lottery.address, ticketPrice, { from: user1 })
        await lottery.buyTickets(1, { from: user1 })
        await lottery.lock(secretHash)
        await lottery.unlock(secret)
        const info = await lottery.getInfo()
        assert.equal(info.supplyBalanceTotal.toString(), web3.utils.toWei('12', 'ether'))
        assert.equal(info.winner, user1)
      })

      it('should succeed even without a balance', async () => {
        await lottery.lock(secretHash)
        await lottery.unlock(secret)
        const info = await lottery.getInfo()
        assert.equal(info.winner, '0x0000000000000000000000000000000000000000')
      })
    })

    describe('withdraw()', () => {
      it('should work for one participant', async () => {
        await token.approve(lottery.address, ticketPrice, { from: user1 })
        await lottery.buyTickets(1, { from: user1 })
        await lottery.lock(secretHash)
        await lottery.unlock(secret)

        let winnings = await lottery.winnings(user1)
        let winningBalance = new BN(web3.utils.toWei('12', 'ether'))
        assert.equal(winnings.toString(), winningBalance.toString())

        const balanceBefore = await token.balanceOf(user1)
        await lottery.withdraw({ from: user1 })
        assert.equal((await lottery.winnings(user1)).toString(), '0')
        const balanceAfter = await token.balanceOf(user1)

        assert.equal(balanceAfter.toString(), (new BN(balanceBefore).add(winningBalance)).toString())
      })

      it('should work for two participants', async () => {
        const priceForTenTickets = ticketPrice.mul(new BN(10))

        await token.approve(lottery.address, priceForTenTickets, { from: user1 })
        await lottery.buyTickets(10, { from: user1 })

        await token.approve(lottery.address, priceForTenTickets, { from: user2 })
        await lottery.buyTickets(10, { from: user2 })

        await lottery.lock(secretHash)
        await lottery.unlock(secret)
        const info = await lottery.getInfo()

        const user1BalanceBefore = await token.balanceOf(user1)
        await lottery.withdraw({ from: user1 })
        const user1BalanceAfter = await token.balanceOf(user1)

        const user2BalanceBefore = await token.balanceOf(user2)
        await lottery.withdraw({ from: user2 })
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
        await token.approve(lottery.address, ticketPrice, { from: user1 })
        await lottery.buyTickets(1, { from: user1 })

        let winnings = await lottery.winnings(user1)

        assert.equal(winnings.toString(), ticketPrice.toString())
      })
    })
  })

  describe('when lottery cannot be bonded yet', () => {
    beforeEach(async () => {
      // one thousand seconds into future
      const bondStartBlock = 15 * blocksPerMinute
      const bondEndBlock = bondStartBlock + 15 * blocksPerMinute
      lottery = await createLottery(bondStartBlock, bondEndBlock)
    })

    describe('lock()', () => {
      beforeEach(async () => {
        await token.approve(lottery.address, ticketPrice, { from: user1 })
        await lottery.buyTickets(1, { from: user1 })
      })

      it('should not work for regular users', async () => {
        let failed
        try {
          await lottery.lock({ from: user1 })
          failed = false
        } catch (error) {
          failed = true
        }

        assert.ok(failed, "lottery should not have locked")
      })

      it('should support early locking by the owner', async () => {
        await lottery.lock(secretHash, { from: owner })
      })
    })
  })

  describe('when lottery cannot be unlocked yet', () => {
    beforeEach(async () => {

      // in the past
      let bondStartBlock = -10

      // in the future
      let bondEndBlock = 15 * blocksPerMinute

      lottery = await createLottery(bondStartBlock, bondEndBlock)
    })

    describe('unlock()', () => {
      beforeEach(async () => {
        await token.approve(lottery.address, ticketPrice, { from: user1 })
        await lottery.buyTickets(1, { from: user1 })
        await lottery.lock(secretHash)
      })

      it('should still work for the owner', async () => {
        await lottery.unlock(secret)
      })

      it('should not work for anyone else', async () => {
        let failed
        try {
          await lottery.unlock({ from: user1 })
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

      const lottery = await createLottery(0, 1)

      const user1Tickets = ticketPrice.mul(new BN(100))
      await token.approve(lottery.address, user1Tickets, { from: user1 })
      await lottery.buyTickets(100, { from: user1 })

      const ownerBalance = await token.balanceOf(owner)
      await lottery.lock(secretHash, { from: owner })

      /// MoneyMarketMock awards 20% regardless of duration.
      const totalDeposit = user1Tickets
      const interestEarned = totalDeposit.mul(new BN(20)).div(new BN(100))
      const fee = interestEarned.mul(new BN(10)).div(new BN(100))

      // we expect unlocking to transfer the fee to the owner
      await lottery.unlock(secret, { from: owner })

      assert.equal((await lottery.feeAmount()).toString(), fee.toString())

      const newOwnerBalance = await token.balanceOf(owner)
      assert.equal(newOwnerBalance.toString(), ownerBalance.add(fee).toString())

      // we expect the lottery winner to receive the interest less the fee
      const user1Balance = await token.balanceOf(user1)
      await lottery.withdraw({ from: user1 })
      const newUser1Balance = await token.balanceOf(user1)
      assert.equal(newUser1Balance.toString(), user1Balance.add(user1Tickets).add(interestEarned).sub(fee).toString())
    })
  })

})
