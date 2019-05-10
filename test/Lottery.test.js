const BN = require('bn.js')
const Token = artifacts.require('Token.sol')
const Lottery = artifacts.require('Lottery.sol')
const MoneyMarketMock = artifacts.require('MoneyMarketMock.sol')
const Fixidity = artifacts.require('Fixidity.sol')

const zero_22 = '0000000000000000000000'

contract('Lottery', (accounts) => {
  let lottery, token, moneyMarket
  
  const blocksPerMinute = 5

  let [owner, admin, user1, user2] = accounts

  let ticketPrice = new BN(web3.utils.toWei('10', 'ether'))
  // let feeFraction = new BN('5' + zero_22) // equal to 0.05
  let feeFraction = new BN('0')

  let secret = '0x1234123412341234123412341234123412341234123412341234123412341234'
  let secretHash = web3.utils.soliditySha3(secret)

  beforeEach(async () => {
    fixidity = await Fixidity.new({ from: admin })

    token = await Token.new({ from: admin })
    await token.initialize(owner)

    moneyMarket = await MoneyMarketMock.new({ from: admin })
    await moneyMarket.initialize(token.address)

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

    const lottery = await Lottery.new(
      moneyMarket.address,
      token.address,
      block + bondStartBlock,
      block + bondEndBlock,
      ticketPrice,
      feeFraction,
      fixidity.address
    )
    lottery.initialize(owner)
    return lottery
  }

  async function blockNumber() {
    return await web3.eth.getBlockNumber()
  }

  describe('lottery with zero open and bond durations', () => {
    beforeEach(async () => {
      lottery = await createLottery()
    })

    describe('buyTicket()', () => {
      it('should fail if not enough tokens approved', async () => {
        await token.approve(lottery.address, ticketPrice.div(new BN(2)), { from: user1 })

        let failed
        try {
          await lottery.buyTicket({ from: user1 })
          failed = false
        } catch (error) {
          failed = true
        }
        assert.ok(failed, "was able to deposit less than the minimum")
      })

      it('should deposit some tokens into the lottery', async () => {
        await token.approve(lottery.address, ticketPrice, { from: user1 })

        const response = await lottery.buyTicket({ from: user1 })
        const depositedEvent = response.receipt.logs[0]
        assert.equal(depositedEvent.event, 'BoughtTicket')
        assert.equal(depositedEvent.address, lottery.address)
        assert.equal(depositedEvent.args[0], user1)
        assert.equal(depositedEvent.args[1].toString(), ticketPrice.toString())
      })

      it('should allow multiple deposits', async () => {
        await token.approve(lottery.address, ticketPrice, { from: user1 })

        await lottery.buyTicket({ from: user1 })

        await token.approve(lottery.address, ticketPrice, { from: user1 })
        await lottery.buyTicket({ from: user1 })

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
        await lottery.buyTicket({ from: user1 })
        await lottery.lock(secretHash)
      })
    })

    describe('unlock()', () => {
      it('should transfer tokens from money market back', async () => {
        await token.approve(lottery.address, ticketPrice, { from: user1 })
        await lottery.buyTicket({ from: user1 })
        await lottery.lock(secretHash)
        await lottery.unlock(secret)
        const info = await lottery.getInfo()
        assert.equal(info.supplyBalanceTotal.toString(), web3.utils.toWei('12', 'ether'))
        assert.equal(info.winner, user1)
      })

      it('should succeed even without a balance', async () => {
        await lottery.lock(secretHash)
        await lottery.unlock(secret)
      })
    })

    describe('withdraw()', () => {
      it('should work for one participant', async () => {
        await token.approve(lottery.address, ticketPrice, { from: user1 })
        await lottery.buyTicket({ from: user1 })
        await lottery.lock(secretHash)
        await lottery.unlock(secret)

        let winnings = await lottery.winnings(user1)
        let winningBalance = new BN(web3.utils.toWei('12', 'ether'))
        assert.equal(winnings.toString(), winningBalance.toString())

        const balanceBefore = await token.balanceOf(user1)
        await lottery.withdraw({ from: user1 })
        const balanceAfter = await token.balanceOf(user1)

        assert.equal(balanceAfter.toString(), (new BN(balanceBefore).add(winningBalance)).toString())
      })

      it('should work for two participants', async () => {
        await token.approve(lottery.address, ticketPrice, { from: user1 })
        await lottery.buyTicket({ from: user1 })

        await token.approve(lottery.address, ticketPrice, { from: user2 })
        await lottery.buyTicket({ from: user2 })

        await lottery.lock(secretHash)
        await lottery.unlock(secret)
        const info = await lottery.getInfo()

        const user1BalanceBefore = await token.balanceOf(user1)
        await lottery.withdraw({ from: user1 })
        const user1BalanceAfter = await token.balanceOf(user1)

        const user2BalanceBefore = await token.balanceOf(user2)
        await lottery.withdraw({ from: user2 })
        const user2BalanceAfter = await token.balanceOf(user2)

        const earnedInterest = new BN(web3.utils.toWei('4', 'ether'))

        if (info.winner === user1) {
          assert.equal(user2BalanceAfter.toString(), (new BN(user2BalanceBefore).add(ticketPrice)).toString())
          assert.equal(user1BalanceAfter.toString(), (new BN(user1BalanceBefore).add(ticketPrice.add(earnedInterest))).toString())
        } else if (info.winner === user2) {
          assert.equal(user2BalanceAfter.toString(), (new BN(user2BalanceBefore).add(ticketPrice.add(earnedInterest))).toString())
          assert.equal(user1BalanceAfter.toString(), (new BN(user1BalanceBefore).add(ticketPrice)).toString())
        } else {
          throw new Error(`Unknown winner: ${info.winner}`)
        }
      })
    })

    describe('winnings()', () => {
      it('should return the entrants total to withdraw', async () => {
        await token.approve(lottery.address, ticketPrice, { from: user1 })
        await lottery.buyTicket({ from: user1 })

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
        await lottery.buyTicket({ from: user1 })
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
        await lottery.buyTicket({ from: user1 })
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
})
