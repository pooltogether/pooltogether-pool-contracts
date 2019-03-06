const BN = require('bn.js')
const Token = artifacts.require('Token.sol')
const PoolTogether = artifacts.require('PoolTogether.sol')
const MoneyMarket = artifacts.require('MoneyMarketMock.sol')

contract('PoolTogether', (accounts) => {
  let poolTogether, token, moneyMarket

  let [owner, admin, user1, user2] = accounts

  beforeEach(async () => {
    token = await Token.new({ from: admin })
    moneyMarket = await MoneyMarket.new(token.address)
    await token.initialize(owner)

    await token.mint(moneyMarket.address, web3.utils.toWei('10000000', 'ether'))
    await token.mint(user1, web3.utils.toWei('100000', 'ether'))
    await token.mint(user2, web3.utils.toWei('100000', 'ether'))
  })

  async function createLottery() {
    let response = await poolTogether.createLottery()
    let lotteryCreatedEvent = response.receipt.logs[0]
    assert.equal(lotteryCreatedEvent.event, 'LotteryCreated')
    return lotteryCreatedEvent.args[0].toString()
  }

  describe('lottery with zero open and bond durations', () => {
    let openDuration = 0
    let bondDuration = 0

    beforeEach(async () => {
      poolTogether = await PoolTogether.new({ from: admin })
      await poolTogether.initialize(token.address, moneyMarket.address, openDuration, bondDuration)
    })

    describe('createLottery', () => {
      it('should create a new lottery', async () => {
        let id = await createLottery()
        assert.equal(id, '0')
      })
    })

    describe('deposit', () => {
      it('should not deposit tokens if no lottery is open', async () => {
        const depositAmount = web3.utils.toWei('20', 'ether')
        await token.approve(poolTogether.address, depositAmount, { from: user1 })

        let failed
        try {
          await poolTogether.deposit(depositAmount, { from: user1 })
          failed = false
        } catch (error) {
          failed = true
        }

        assert.ok(failed, "deposit succeeded")
      })

      it('should deposit some tokens into the lottery', async () => {
        const depositAmount = web3.utils.toWei('20', 'ether')
        await poolTogether.createLottery()
        await token.approve(poolTogether.address, depositAmount, { from: user1 })

        const response = await poolTogether.deposit(depositAmount, { from: user1 })
        const depositedEvent = response.receipt.logs[0]
        assert.equal(depositedEvent.event, 'Deposited')
        assert.equal(depositedEvent.args[0], '0')
        assert.equal(depositedEvent.args[1], user1)
        assert.equal(depositedEvent.args[2], depositAmount)
      })

      it('should allow multiple deposits', async () => {
        const depositAmount = web3.utils.toWei('20', 'ether')
        await poolTogether.createLottery()
        await token.approve(poolTogether.address, depositAmount, { from: user1 })

        await poolTogether.deposit(depositAmount, { from: user1 })

        await token.approve(poolTogether.address, depositAmount, { from: user1 })
        await poolTogether.deposit(depositAmount, { from: user1 })

        const response = await poolTogether.getEntry('0', user1)
        assert.equal(response.addr, user1)
        assert.equal(response.amount.toString(), web3.utils.toWei('40', 'ether'))
      })
    })

    describe('lockLottery()', () => {
      it('should transfer tokens to the money market', async () => {
        const depositAmount = web3.utils.toWei('20', 'ether')
        await poolTogether.createLottery()
        await token.approve(poolTogether.address, depositAmount, { from: user1 })
        await poolTogether.deposit(depositAmount, { from: user1 })
        await poolTogether.lockLottery()
      })
    })

    describe('unlockLottery()', () => {
      it('should transfer tokens from money market back', async () => {
        const depositAmount = web3.utils.toWei('20', 'ether')
        let lotteryId = await createLottery()
        await token.approve(poolTogether.address, depositAmount, { from: user1 })
        await poolTogether.deposit(depositAmount, { from: user1 })
        await poolTogether.lockLottery()
        await poolTogether.unlockLottery(lotteryId)
        const lottery = await poolTogether.getLottery(lotteryId)
        assert.equal(lottery.finalAmount, web3.utils.toWei('24', 'ether'))
        assert.equal(lottery.winnerIndex, '0')
      })
    })

    describe('withdraw()', () => {
      it('should work for one participant', async () => {
        const depositAmount = web3.utils.toWei('20', 'ether')
        let lotteryId = await createLottery()
        await token.approve(poolTogether.address, depositAmount, { from: user1 })
        await poolTogether.deposit(depositAmount, { from: user1 })
        await poolTogether.lockLottery()
        await poolTogether.unlockLottery(lotteryId)

        const balanceBefore = await token.balanceOf(user1)
        await poolTogether.withdraw(lotteryId, { from: user1 })
        const balanceAfter = await token.balanceOf(user1)

        assert.equal(balanceAfter.toString(), (new BN(balanceBefore).add(new BN(web3.utils.toWei('24', 'ether')))).toString())
      })

      it('should work for two participants', async () => {
        const depositAmount = web3.utils.toWei('20', 'ether')

        let lotteryId = await createLottery()

        await token.approve(poolTogether.address, depositAmount, { from: user1 })
        await poolTogether.deposit(depositAmount, { from: user1 })

        await token.approve(poolTogether.address, depositAmount, { from: user2 })
        await poolTogether.deposit(depositAmount, { from: user2 })

        await poolTogether.lockLottery()
        await poolTogether.unlockLottery(lotteryId)
        let lottery = await poolTogether.getLottery(lotteryId)

        const user1BalanceBefore = await token.balanceOf(user1)
        await poolTogether.withdraw(lotteryId, { from: user1 })
        const user1BalanceAfter = await token.balanceOf(user1)

        const user2BalanceBefore = await token.balanceOf(user2)
        await poolTogether.withdraw(lotteryId, { from: user2 })
        const user2BalanceAfter = await token.balanceOf(user2)

        if (lottery.winnerIndex.eq(new BN(0))) {
          assert.equal(user1BalanceAfter.toString(), (new BN(user1BalanceBefore).add(new BN(web3.utils.toWei('28', 'ether')))).toString())
          assert.equal(user2BalanceAfter.toString(), (new BN(user2BalanceBefore).add(new BN(web3.utils.toWei('20', 'ether')))).toString())
        } else if (lottery.winnerIndex.eq(new BN(1))) {
          assert.equal(user1BalanceAfter.toString(), (new BN(user1BalanceBefore).add(new BN(web3.utils.toWei('20', 'ether')))).toString())
          assert.equal(user2BalanceAfter.toString(), (new BN(user2BalanceBefore).add(new BN(web3.utils.toWei('28', 'ether')))).toString())
        } else {
          throw new Error(`Unknown winner index: ${lottery.winnerIndex}`)
        }
      })
    })
  })

  describe('when lottery has a open duration', () => {
    let openDuration = 1000 // seconds
    let bondDuration = 0

    beforeEach(async () => {
      poolTogether = await PoolTogether.new({ from: admin })
      await poolTogether.initialize(token.address, moneyMarket.address, openDuration, bondDuration)
    })

    describe('lockLottery()', () => {
      it('should not', async () => {
        const depositAmount = web3.utils.toWei('20', 'ether')
        await poolTogether.createLottery()
        await token.approve(poolTogether.address, depositAmount, { from: user1 })
        await poolTogether.deposit(depositAmount, { from: user1 })
        let failed
        try {
          await poolTogether.lockLottery()
          failed = false
        } catch (error) {
          failed = true
        }

        assert.ok(failed, "lottery should not have locked")
      })
    })
  })
})
