const BN = require('bn.js')
const Token = artifacts.require('Token.sol')
const Lottery = artifacts.require('Lottery.sol')
const MoneyMarketMock = artifacts.require('MoneyMarketMock.sol')

contract('Lottery', (accounts) => {
  let lottery, token, moneyMarket

  let [owner, admin, user1, user2] = accounts

  let bondStartTime = 0
  let bondEndTime = 0

  beforeEach(async () => {
    token = await Token.new({ from: admin })
    await token.initialize(owner)

    moneyMarket = await MoneyMarketMock.new({ from: admin })
    await moneyMarket.initialize(token.address)

    await token.mint(moneyMarket.address, web3.utils.toWei('10000000', 'ether'))
    await token.mint(user1, web3.utils.toWei('100000', 'ether'))
    await token.mint(user2, web3.utils.toWei('100000', 'ether'))
  })

  async function createLottery() {
    return await Lottery.new(moneyMarket.address, token.address, bondStartTime, bondEndTime)
  }

  describe('lottery with zero open and bond durations', () => {

    beforeEach(async () => {
      lottery = await createLottery()
    })

    describe('deposit', () => {
      it('should deposit some tokens into the lottery', async () => {
        const depositAmount = web3.utils.toWei('20', 'ether')
        await token.approve(lottery.address, depositAmount, { from: user1 })

        const response = await lottery.deposit(depositAmount, { from: user1 })
        const depositedEvent = response.receipt.logs[0]
        assert.equal(depositedEvent.event, 'Deposited')
        assert.equal(depositedEvent.address, lottery.address)
        assert.equal(depositedEvent.args[0], user1)
        assert.equal(depositedEvent.args[1], depositAmount)
      })

      it('should allow multiple deposits', async () => {
        const depositAmount = web3.utils.toWei('20', 'ether')
        await token.approve(lottery.address, depositAmount, { from: user1 })

        await lottery.deposit(depositAmount, { from: user1 })

        await token.approve(lottery.address, depositAmount, { from: user1 })
        await lottery.deposit(depositAmount, { from: user1 })

        const response = await lottery.getEntry(user1)
        assert.equal(response.addr, user1)
        assert.equal(response.amount.toString(), web3.utils.toWei('40', 'ether'))
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
        const depositAmount = web3.utils.toWei('20', 'ether')
        await token.approve(lottery.address, depositAmount, { from: user1 })
        await lottery.deposit(depositAmount, { from: user1 })
        await lottery.lock()
      })
    })

    describe('unlock()', () => {
      it('should transfer tokens from money market back', async () => {
        const depositAmount = web3.utils.toWei('20', 'ether')
        await token.approve(lottery.address, depositAmount, { from: user1 })
        await lottery.deposit(depositAmount, { from: user1 })
        await lottery.lock()
        await lottery.unlock()
        const info = await lottery.getInfo()
        assert.equal(info.supplyBalanceTotal, web3.utils.toWei('24', 'ether'))
        assert.equal(info.winner, user1)
      })

      it('should succeed even without a balance', async () => {
        await lottery.lock()
        await lottery.unlock()
      })
    })

    describe('withdraw()', () => {
      it('should work for one participant', async () => {
        const depositAmount = web3.utils.toWei('20', 'ether')
        await token.approve(lottery.address, depositAmount, { from: user1 })
        await lottery.deposit(depositAmount, { from: user1 })
        await lottery.lock()
        await lottery.unlock()

        const balanceBefore = await token.balanceOf(user1)
        await lottery.withdraw({ from: user1 })
        const balanceAfter = await token.balanceOf(user1)

        assert.equal(balanceAfter.toString(), (new BN(balanceBefore).add(new BN(web3.utils.toWei('24', 'ether')))).toString())
      })

      it('should work for two participants', async () => {
        const depositAmount = web3.utils.toWei('20', 'ether')

        await token.approve(lottery.address, depositAmount, { from: user1 })
        await lottery.deposit(depositAmount, { from: user1 })

        await token.approve(lottery.address, depositAmount, { from: user2 })
        await lottery.deposit(depositAmount, { from: user2 })

        await lottery.lock()
        await lottery.unlock()
        const info = await lottery.getInfo()

        const user1BalanceBefore = await token.balanceOf(user1)
        await lottery.withdraw({ from: user1 })
        const user1BalanceAfter = await token.balanceOf(user1)

        const user2BalanceBefore = await token.balanceOf(user2)
        await lottery.withdraw({ from: user2 })
        const user2BalanceAfter = await token.balanceOf(user2)

        if (info.winner === user1) {
          assert.equal(user1BalanceAfter.toString(), (new BN(user1BalanceBefore).add(new BN(web3.utils.toWei('28', 'ether')))).toString())
          assert.equal(user2BalanceAfter.toString(), (new BN(user2BalanceBefore).add(new BN(web3.utils.toWei('20', 'ether')))).toString())
        } else if (info.winner === user2) {
          assert.equal(user1BalanceAfter.toString(), (new BN(user1BalanceBefore).add(new BN(web3.utils.toWei('20', 'ether')))).toString())
          assert.equal(user2BalanceAfter.toString(), (new BN(user2BalanceBefore).add(new BN(web3.utils.toWei('28', 'ether')))).toString())
        } else {
          throw new Error(`Unknown winner: ${info.winner}`)
        }
      })
    })
  })

  describe('when lottery cannot be bonded yet', () => {
    beforeEach(async () => {
      // one thousand seconds into future
      let bondStartTimeS = parseInt((new Date().getTime() / 1000) + 1000, 10)
      let bondEndTimeS = parseInt(bondStartTimeS + 1000, 10)
      lottery = await Lottery.new(moneyMarket.address, token.address, bondStartTimeS, bondEndTimeS)
    })

    describe('lock()', () => {
      it('should not work', async () => {
        const depositAmount = web3.utils.toWei('20', 'ether')
        await token.approve(lottery.address, depositAmount, { from: user1 })
        await lottery.deposit(depositAmount, { from: user1 })
        let failed
        try {
          await lottery.lock()
          failed = false
        } catch (error) {
          failed = true
        }

        assert.ok(failed, "lottery should not have locked")
      })
    })
  })

  describe('when lottery cannot be unlocked yet', () => {
    beforeEach(async () => {
      // 15 seconds into the past
      let bondStartTimeS = parseInt((new Date().getTime() / 1000) - 15, 10)

      // 985 seconds into the future
      let bondEndTimeS = parseInt(bondStartTimeS + 1000000, 10)

      lottery = await Lottery.new(
        moneyMarket.address, token.address, bondStartTimeS, bondEndTimeS
      )
    })

    describe('unlock()', () => {
      it('should not work', async () => {
        const depositAmount = web3.utils.toWei('20', 'ether')
        await token.approve(lottery.address, depositAmount, { from: user1 })
        await lottery.deposit(depositAmount, { from: user1 })
        await lottery.lock()

        let failed
        try {
          await lottery.unlock()
          failed = false
        } catch (error) {
          failed = true
        }

        assert.ok(failed, "lottery should not have been unlocked")
      })
    })
  })
})
