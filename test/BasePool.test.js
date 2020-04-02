const toWei = require('./helpers/toWei')
const fromWei = require('./helpers/fromWei')
const chai = require('./helpers/chai')
const PoolContext = require('./helpers/PoolContext')
const setupERC1820 = require('./helpers/setupERC1820')
const BN = require('bn.js')
const Pool = artifacts.require('MCDAwarePool.sol')
const MockRewardListener = artifacts.require('MockRewardListener.sol')
const BrokenRewardListener = artifacts.require('BrokenRewardListener.sol')
const {
  SECRET,
  SALT,
  MAX_NEW_FIXED,
  SECRET_HASH,
  ZERO_ADDRESS,
  TICKET_PRICE
} = require('./helpers/constants')

const debug = require('debug')('Pool.test.js')

const REWARD_LISTENER_INTERFACE_HASH = web3.utils.soliditySha3('PoolTogetherRewardListener')

contract('BasePool', (accounts) => {
  let pool, token, moneyMarket
  
  const [owner, admin, user1, user2] = accounts

  const priceForTenTickets = TICKET_PRICE.mul(new BN(10))

  let feeFraction, contracts

  let poolContext = new PoolContext({ web3, artifacts, accounts })

  beforeEach(async () => {
    // reset the users interface implementer
    registry = await setupERC1820({ web3, artifacts, account: owner })
    await registry.setInterfaceImplementer(user1, REWARD_LISTENER_INTERFACE_HASH, ZERO_ADDRESS, { from: user1 })
    feeFraction = new BN('0')
    await poolContext.init()
    contracts = poolContext
    token = contracts.token
    moneyMarket = contracts.moneyMarket
    await Pool.link("DrawManager", contracts.drawManager.address)
    await Pool.link("FixidityLib", contracts.fixidity.address)
    await Pool.link("Blocklock", contracts.blocklock.address)
  })

  describe('init()', () => {
    xit('should fail if owner is zero', async () => {
      pool = await Pool.new()
      await chai.assert.isRejected(pool.init(
        ZERO_ADDRESS,
        moneyMarket.address,
        new BN('0'),
        owner,
        10,
        10
      ), /Pool\/owner-zero/)
    })

    xit('should fail if moneymarket is zero', async () => {
      pool = await Pool.new()
      await chai.assert.isRejected(pool.init(
        owner,
        ZERO_ADDRESS,
        new BN('0'),
        owner,
        10,
        10
      ), /Pool\/ctoken-zero/)
    })
  })

  describe('addAdmin()', () =>{
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
    })

    xit('should allow an admin to add another', async () => {
      await pool.addAdmin(user1)
      assert.ok(await pool.isAdmin(user1))
    })

    xit('should not allow a non-admin to remove an admin', async () => {
      await chai.assert.isRejected(pool.addAdmin(user2, { from: user1 }), /Pool\/admin/)
    })
  })

  describe('removeAdmin()', () =>{
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
      await pool.addAdmin(user1)
    })

    xit('should allow an admin to remove another', async () => {
      await pool.removeAdmin(user1)
      assert.ok(!(await pool.isAdmin(user1)))
    })

    xit('should not allow a non-admin to remove an admin', async () => {
      await chai.assert.isRejected(pool.removeAdmin(user1, { from: admin }), /Pool\/admin/)
    })

    xit('should not an admin to remove an non-admin', async () => {
      await chai.assert.isRejected(pool.removeAdmin(user2), /Pool\/no-admin/)
    })

    xit('should not allow an admin to remove themselves', async () => {
      await chai.assert.isRejected(pool.removeAdmin(owner), /Pool\/remove-self/)
    })
  })

  describe('supplyRatePerBlock()', () => {
    xit('should work', async () => {
      pool = await poolContext.createPool(feeFraction) // ten blocks long
      assert.equal(await pool.supplyRatePerBlock(), web3.utils.toWei('0.1', 'ether'))
    })
  })

  describe('committedBalanceOf()', () => {
    xit('should return the users balance for the current draw', async () => {
      pool = await poolContext.createPool(feeFraction)

      await poolContext.depositPool(TICKET_PRICE, { from: user1 })

      assert.equal((await pool.committedBalanceOf(user1)).toString(), '0')

      await poolContext.nextDraw()

      assert.equal(await pool.committedBalanceOf(user1), TICKET_PRICE.toString())
    })
  })

  describe('openBalanceOf()', () => {
    xit('should return the users balance for the current draw', async () => {
      pool = await poolContext.createPool(feeFraction)

      await token.approve(pool.address, TICKET_PRICE, { from: user1 })
      await pool.depositPool(TICKET_PRICE, { from: user1 })

      assert.equal((await pool.openBalanceOf(user1)).toString(), TICKET_PRICE.toString())

      await poolContext.nextDraw()

      assert.equal(await pool.openBalanceOf(user1), '0')
    })
  })

  describe('estimatedInterestRate()', () => {
    xit('should set an appropriate limit based on max integers', async () => {
      pool = await poolContext.createPool(feeFraction) // ten blocks long

      const interestRate = await pool.estimatedInterestRate(10);
      assert.equal(interestRate.toString(), '1000000000000000000')
    })
  })

  describe('getDraw()', () => {
    xit('should return empty values if no draw exists', async () => {
      pool = await poolContext.createPool(feeFraction)
      const draw = await pool.getDraw(12)
      assert.equal(draw.feeFraction, '0')
      assert.equal(draw.feeBeneficiary, ZERO_ADDRESS)
      assert.equal(draw.openedBlock, '0')
      assert.equal(draw.secretHash, '0x0000000000000000000000000000000000000000000000000000000000000000')
    })

    xit('should return true values if a draw exists', async () => {
      feeFraction = toWei('0.1')
      pool = await poolContext.createPool(feeFraction)
      await poolContext.nextDraw()
      const draw = await pool.getDraw(1)
      assert.equal(draw.feeFraction.toString(), feeFraction.toString())
      assert.equal(draw.feeBeneficiary, owner)
      assert.ok(draw.openedBlock !== '0')
      assert.equal(draw.secretHash, SECRET_HASH)
    })
  })

  describe('openNextDraw()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
    })

    xit('should have opened a draw', async () => {
      assert.equal(await pool.currentOpenDrawId(), '1')
      const events = await pool.getPastEvents()
      assert.equal(events.length, 1)
      const firstEvent = events[0]
      assert.equal(firstEvent.event, 'Opened')
      const { drawId } = firstEvent.args
      assert.equal(drawId, '1')
    })

    xit('should emit a committed event', async () => {
      const tx = await pool.openNextDraw(SECRET_HASH) // now has a committed draw

      const [Committed, Opened] = tx.logs
      assert.equal(Committed.event, 'Committed')
      assert.equal(Committed.args.drawId, '1')
      assert.equal(Opened.event, 'Opened')
      assert.equal(Opened.args.drawId, '2')
    })

    xit('should revert when the committed draw has not been rewarded', async () => {
      await pool.openNextDraw(SECRET_HASH)
      await chai.assert.isRejected(pool.openNextDraw(SECRET_HASH), /Pool\/not-reward/)
    })

    xit('should succeed when the committed draw has been rewarded', async () => {
      await pool.openNextDraw(SECRET_HASH) // now has a committed draw 2
      await pool.lockTokens()
      await pool.reward(SECRET, SALT) // committed draw 2 is now rewarded
      const tx = await pool.openNextDraw(SECRET_HASH) // now can open the next draw 3

      const [Committed, Opened] = tx.logs
      assert.equal(Committed.event, 'Committed')
      assert.equal(Committed.args.drawId, '2')
      assert.equal(Opened.event, 'Opened')
      assert.equal(Opened.args.drawId, '3')
    })
  })

  describe('reward()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
    })

    xit('should fail if there is no committed draw', async () => {
      await pool.lockTokens()
      await chai.assert.isRejected(pool.reward(SECRET, SALT), /Pool\/committed/)
    })

    xit('should fail if the committed draw has already been rewarded', async () => {
      await poolContext.nextDraw()
      await pool.lockTokens()
      await pool.reward(SECRET, SALT)

      // Trigger the next block (only on testrpc!)
      await web3.eth.sendTransaction({ to: user1, from: user2, value: 1 })
      await pool.lockTokens()
      await chai.assert.isRejected(pool.reward(SECRET, SALT), /Pool\/already/)
    })

    xit('should fail if the secret does not match', async () => {
      await pool.openNextDraw(SECRET_HASH) // now committed and open
      await pool.lockTokens()
      await chai.assert.isRejected(pool.reward('0xdeadbeef', SALT), /Pool\/bad-secret/)
    })

    xit('should award the interest to the winner', async () => {
      await poolContext.depositPool(toWei('10'), { from: user1 })
      await pool.openNextDraw(SECRET_HASH) // now committed and open
      await moneyMarket.reward(pool.address)
      await pool.lockTokens()
      await pool.reward(SECRET, SALT) // reward winnings to user1 and fee to owner
      assert.equal(await pool.balanceOf(user1), toWei('10'))
      assert.equal(await pool.openBalanceOf(user1), toWei('2'))
    })

    xit('should call the reward listener if set', async () => {
      rewardListener = await MockRewardListener.new()
      registry.setInterfaceImplementer(user1, REWARD_LISTENER_INTERFACE_HASH, rewardListener.address, { from: user1 })
      await poolContext.depositPool(toWei('10'), { from: user1 })
      await pool.openNextDraw(SECRET_HASH) // now committed and open
      await moneyMarket.reward(pool.address)
      await pool.lockTokens()
      await pool.reward(SECRET, SALT) // reward winnings to user1 and fee to owner
      assert.equal(await pool.balanceOf(user1), toWei('10'))
      assert.equal(await pool.openBalanceOf(user1), toWei('2'))
      assert.equal(await rewardListener.lastWinnings(), toWei('2'))
    })

    xit('should gracefully handle a broken reward listener', async () => {
      rewardListener = await BrokenRewardListener.new()
      registry.setInterfaceImplementer(user1, REWARD_LISTENER_INTERFACE_HASH, rewardListener.address, { from: user1 })
      await poolContext.depositPool(toWei('10'), { from: user1 })
      await pool.openNextDraw(SECRET_HASH) // now committed and open
      await moneyMarket.reward(pool.address)
      await pool.lockTokens()
      await pool.reward(SECRET, SALT) // reward winnings to user1 and fee to owner
      assert.equal(await pool.balanceOf(user1), toWei('10'))
      assert.equal(await pool.openBalanceOf(user1), toWei('2'))
    })

    xit('can only be run by an admin', async () => {
      await pool.openNextDraw(SECRET_HASH) // now committed and open
      await chai.assert.isRejected(pool.reward(SECRET, SALT, { from: user1 }), /Pool\/admin/)
    })
  })

  describe('rolloverAndOpenNextDraw()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
    })

    xit('should not run if there is no committed draw', async () => {
      await chai.assert.isRejected(pool.rolloverAndOpenNextDraw(SECRET_HASH), /Pool\/committed/)
    })

    xit('should not run if the committed draw has already been rewarded', async () => {
      // the committed draw has already been rewarded
      await poolContext.nextDraw() // have an open draw and committed draw
      await pool.lockTokens()
      await pool.reward(SECRET, SALT)
      await chai.assert.isRejected(pool.rolloverAndOpenNextDraw(SECRET_HASH), /Pool\/already/)
    })

    xit('should only be run by an admin', async () => {
      await poolContext.nextDraw()
      await chai.assert.isRejected(pool.rolloverAndOpenNextDraw(SECRET_HASH, { from: user1 }), /Pool\/admin/)
    })

    xit('should rollover the draw and open the next', async () => {
      await poolContext.nextDraw()
      const tx = await pool.rolloverAndOpenNextDraw(SECRET_HASH)
      const [RolledOver, Rewarded, Committed, Opened] = tx.logs
      assert.equal(RolledOver.event, 'RolledOver')
      assert.equal(Rewarded.event, 'Rewarded')
      assert.equal(Committed.event, 'Committed')
      assert.equal(Opened.event, 'Opened')
    })
  })

  describe('rollover()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
    })

    xit('should only be called by admin', async () => {
      await pool.openNextDraw(SECRET_HASH) // now have committed
      await chai.assert.isRejected(pool.rollover({from: user1}), /Pool\/admin/)
    })

    xit('should not run if there is no committed draw', async () => {
      await chai.assert.isRejected(pool.rollover(), /Pool\/committed/)
    })

    xit('should not run if the committed draw has been rewarded', async () => {
      // the committed draw has already been rewarded
      await poolContext.nextDraw() // have an open draw and committed draw
      await pool.lockTokens()
      await pool.reward(SECRET, SALT)
      await chai.assert.isRejected(pool.rollover(), /Pool\/already/)
    })

    xit('should reward the pool with 0', async () => {
      await poolContext.nextDraw() // have an open draw and committed draw
      const tx = await pool.rollover()
      const [RolledOver, Rewarded] = tx.logs
      assert.equal(RolledOver.event, 'RolledOver')
      assert.equal(RolledOver.args.drawId, '1')
      assert.equal(Rewarded.event, 'Rewarded')
      assert.equal(Rewarded.args.drawId, '1')
      assert.equal(Rewarded.args.winner, ZERO_ADDRESS)
      assert.equal(Rewarded.args.entropy, '0x0000000000000000000000000000000000000000000000000000000000000001')
      assert.equal(Rewarded.args.fee, '0')
      assert.equal(Rewarded.args.winnings, '0')

      const draw = await pool.getDraw('1')
      assert.equal(draw.entropy, '0x0000000000000000000000000000000000000000000000000000000000000001')

      await poolContext.openNextDraw(SECRET_HASH) // now continue
    })
  })

  describe('lockTokens()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction, 12)
    })

    xit('should lock the pool', async () => {
      assert.equal(await pool.isLocked(), false)
      await pool.lockTokens()
      assert.equal(await pool.isLocked(), true)
    })

    xit('should only be called by the admin', async () => {
      await chai.assert.isRejected(pool.lockTokens({ from: user1 }), /Pool\/admin/)
    })
  })

  describe('lockDuration()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction, 12)
    })

    xit('should return the lock duration', async () => {
      assert.equal(await pool.lockDuration(), '2')
    })
  })

  describe('lockEndAt()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction, 12)
    })

    xit('should return the lock end block', async () => {
      await pool.lockTokens()
      const blockNumber = await web3.eth.getBlockNumber()
      assert.equal((await pool.lockEndAt()).toString(), '' + (blockNumber + 2))
    })
  })

  describe('cooldownEndAt()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction, 12)
    })

    xit('should return the cooldown end block', async () => {
      await pool.lockTokens()
      const blockNumber = await web3.eth.getBlockNumber()
      assert.equal((await pool.cooldownEndAt()).toString(), '' + (blockNumber + 2 + 12))
    })
  })

  describe('cooldownDuration()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction, 12)
    })

    xit('should return the cooldown duration', async () => {
      assert.equal(await pool.cooldownDuration(), '12')
    })
  })

  describe('unlockTokens()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
      await pool.lockTokens()  
    })

    xit('should unlock the pool', async () => {
      await pool.unlockTokens()  
      assert.equal(await pool.isLocked(), false)
    })

    xit('should only be called by the admin', async () => {
      await chai.assert.isRejected(pool.unlockTokens({ from: user1 }), /Pool\/admin/)
    })
  })

  describe('rewardAndOpenNextDraw()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
    })

    xit('should revert if the pool isnt locked', async () => {
      await chai.assert.isRejected(pool.rewardAndOpenNextDraw(SECRET_HASH, SECRET, SALT), /Pool\/unlocked/)
    })

    xit('should revert if there is no committed draw', async () => {
      await pool.lockTokens()
      await chai.assert.isRejected(pool.rewardAndOpenNextDraw(SECRET_HASH, SECRET, SALT), /Pool\/committed/)
    })

    xit('should fail if the secret does not match', async () => {
      await pool.openNextDraw(SECRET_HASH)
      await pool.lockTokens()
      await chai.assert.isRejected(pool.rewardAndOpenNextDraw(SECRET_HASH, SALT, SECRET), /Pool\/bad-secret/)
    })
  })

  describe('depositPool()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPoolNoOpenDraw()
    })

    xit('should fail if there is no open draw', async () => {
      await token.approve(pool.address, TICKET_PRICE, { from: user1 })

      await chai.assert.isRejected(pool.depositPool(TICKET_PRICE, { from: user1 }), /Pool\/no-open/)
    })
  })

  describe('with a fresh pool', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
    })

    describe('depositPool()', () => {
      xit('should fail if not enough tokens approved', async () => {
        await token.approve(pool.address, TICKET_PRICE.div(new BN(2)), { from: user1 })
        await chai.assert.isRejected(pool.depositPool(TICKET_PRICE, { from: user1 }))
      })

      xit('should deposit some tokens into the pool', async () => {
        await token.approve(pool.address, TICKET_PRICE, { from: user1 })

        const response = await pool.depositPool(TICKET_PRICE, { from: user1 })
        const deposited = response.receipt.logs[response.receipt.logs.length - 1]
        assert.equal(deposited.event, 'Deposited')
        assert.equal(deposited.address, pool.address)
        assert.equal(deposited.args[0], user1)
        assert.equal(deposited.args[1].toString(), toWei('10'))
      })

      xit('should allow multiple deposits', async () => {
        await token.approve(pool.address, TICKET_PRICE, { from: user1 })

        await pool.depositPool(TICKET_PRICE, { from: user1 })

        await token.approve(pool.address, TICKET_PRICE, { from: user1 })
        await pool.depositPool(TICKET_PRICE, { from: user1 })

        const amount = await pool.totalBalanceOf(user1)
        assert.equal(amount.toString(), TICKET_PRICE.mul(new BN(2)).toString())
      })
    })

    describe('depositSponsorship()', () => {
      beforeEach(async () => {
        await token.approve(pool.address, TICKET_PRICE, { from: user1 })
        await pool.depositPool(TICKET_PRICE, { from: user1 })
      })

      xit('should contribute to the winnings', async () => {
        await poolContext.nextDraw()

        await token.approve(pool.address, toWei('1000'), { from: user2 })
        await pool.depositSponsorship(toWei('1000'), { from: user2 })
        
        // Sponsor has no pool balance
        assert.equal((await pool.openBalanceOf(user2)).toString(), toWei('0'))
        assert.equal((await pool.committedBalanceOf(user2)).toString(), toWei('0'))

        // Sponsor has balance
        assert.equal((await pool.totalBalanceOf(user2)).toString(), toWei('1000'))

        // Sponsor has a sponsorship balance
        assert.equal((await pool.totalBalanceOf(user2)).toString(), toWei('1000'))

        const { Rewarded } = await poolContext.nextDraw()

        assert.equal(Rewarded.event, 'Rewarded')
        assert.equal(Rewarded.args.winner, user1)

        // User's winnings include interest from the sponsorship
        assert.equal(Rewarded.args.winnings.toString(), toWei('202'))

        // User's balance includes their winnings and the ticket price
        assert.equal((await pool.totalBalanceOf(user1)).toString(), toWei('212'))
      })
    })

    describe('withdrawSponsorshipAndFee()', () => {
      xit('should withdraw the sponsorship and any fees they have taken', async () => {
        await token.approve(pool.address, toWei('1000'), { from: user2 })
        await pool.depositSponsorship(toWei('1000'), { from: user2 })
        assert.equal(await pool.sponsorshipAndFeeBalanceOf(user2), toWei('1000'))

        const { logs } = await pool.withdrawSponsorshipAndFee(toWei('500'), { from: user2 })

        assert.equal(await pool.sponsorshipAndFeeBalanceOf(user2), toWei('500'))

        const [ SponsorshipAndFeesWithdrawn ] = logs

        assert.equal(SponsorshipAndFeesWithdrawn.event, 'SponsorshipAndFeesWithdrawn')
        assert.equal(SponsorshipAndFeesWithdrawn.args.sender, user2)
        assert.equal(SponsorshipAndFeesWithdrawn.args.amount, toWei('500'))
      })

      xit('does not allow a withdrawal when their balance is zero', async () => {
        await chai.assert.isRejected(pool.withdrawSponsorshipAndFee(toWei('500'), { from: user2 }), /Pool\/exceeds-sfee/)
      })

      xit('does not allow a withdrawal that exceeds their balance', async () => {
        await token.approve(pool.address, toWei('1000'), { from: user2 })
        await pool.depositSponsorship(toWei('1000'), { from: user2 })
        await chai.assert.isRejected(pool.withdrawSponsorshipAndFee(toWei('1000.01'), { from: user2 }), /Pool\/exceeds-sfee/)
      })
    })

    describe('withdrawOpenDeposit()', () => {
      xit('should allow a user to withdraw their open deposit', async () => {
        await token.approve(pool.address, toWei('10'), { from: user1 })
        await pool.depositPool(toWei('10'), { from: user1 })

        assert.equal(await pool.openBalanceOf(user1), toWei('10'))

        const { logs } = await pool.withdrawOpenDeposit(toWei('10'), { from: user1 })

        assert.equal(await pool.openBalanceOf(user1), toWei('0'))

        const [ OpenDepositWithdrawn ] = logs

        assert.equal(OpenDepositWithdrawn.event, 'OpenDepositWithdrawn')
        assert.equal(OpenDepositWithdrawn.args.sender, user1)
        assert.equal(OpenDepositWithdrawn.args.amount, toWei('10'))
      })

      xit('should allow a user to partially withdraw their open deposit', async () => {
        await token.approve(pool.address, toWei('10'), { from: user1 })
        await pool.depositPool(toWei('10'), { from: user1 })
        assert.equal(await pool.openBalanceOf(user1), toWei('10'))
        await pool.withdrawOpenDeposit(toWei('6'), { from: user1 })
        assert.equal(await pool.openBalanceOf(user1), toWei('4'))
      })

      xit('should not allow a user to withdraw more than their open deposit', async () => {
        await chai.assert.isRejected(pool.withdrawOpenDeposit(toWei('6'), { from: user1 }), /DrawMan\/exceeds-open/)
      })
    })

    describe('withdraw(uint256)',  () => {
      describe('sponsorship', () => {
        xit('should allow a user to withdraw their full sponsorship', async () => {
          await token.approve(pool.address, toWei('1000'), { from: user2 })
          await pool.depositSponsorship(toWei('1000'), { from: user2 })
          await pool.withdraw(toWei('1000'), { from: user2 })

          assert.equal(await pool.sponsorshipAndFeeBalanceOf(user2), toWei('0'))
        })
      })

      describe('open deposits', () => {
        xit('should allow a user to withdraw their open deposit', async () => {
          await token.approve(pool.address, toWei('10'), { from: user1 })
          await pool.depositPool(toWei('10'), { from: user1 })
          await pool.withdraw(toWei('10'), { from: user1 })

          assert.equal(await pool.openBalanceOf(user1), '0')
        })
      })

      describe('committed deposits', () => {
        it('should allow a user to withdraw their committed deposit', async () => {
          await token.approve(pool.address, toWei('10'), { from: user1 })
          await pool.depositPool(toWei('10'), { from: user1 })
          await poolContext.nextDraw()
          await pool.withdraw(toWei('10'), { from: user1 })

          assert.equal(await pool.committedBalanceOf(user1), '0')
        })
      })

      describe('all', () => {
        it('should allow a user to withdraw all of their deposits', async () => {
          await token.approve(pool.address, toWei('1000'), { from: user2 })
          await pool.depositSponsorship(toWei('1000'), { from: user2 })

          await token.approve(pool.address, toWei('10'), { from: user2 })
          await pool.depositPool(toWei('10'), { from: user2 })

          await poolContext.nextDraw()

          await token.approve(pool.address, toWei('10'), { from: user2 })
          await pool.depositPool(toWei('10'), { from: user2 })

          await pool.withdraw(toWei('1020'), { from: user2 })

          assert.equal(await pool.sponsorshipAndFeeBalanceOf(user2), toWei('0'))
          assert.equal(await pool.openBalanceOf(user1), '0')
          assert.equal(await pool.committedBalanceOf(user1), '0')
        })
      })
    })

    describe('withdrawCommittedDeposit()', () => {
      xit('should allow a user to withdraw their committed deposit', async () => {
        await token.approve(pool.address, toWei('10'), { from: user1 })
        await pool.depositPool(toWei('10'), { from: user1 })
        await poolContext.nextDraw()

        const { logs } = await pool.withdrawCommittedDeposit(toWei('3'), { from: user1 })
        assert.equal(await pool.committedBalanceOf(user1), toWei('7'))

        const [ CommittedDepositWithdrawn ] = logs

        assert.equal(CommittedDepositWithdrawn.event, 'CommittedDepositWithdrawn')
        assert.equal(CommittedDepositWithdrawn.args.sender, user1)
        assert.equal(CommittedDepositWithdrawn.args.amount, toWei('3'))
      })

      xit('should call burn on the poolToken if available', async () => {
        let poolToken = await poolContext.createToken()

        await token.approve(pool.address, toWei('10'), { from: user1 })
        await pool.depositPool(toWei('10'), { from: user1 })
        await poolContext.nextDraw()

        const { receipt } = await pool.withdrawCommittedDeposit(toWei('3'), { from: user1 })

        const [Redeemed] = await poolToken.getPastEvents({fromBlock: receipt.blockNumber, toBlock: 'latest'})

        assert.equal(Redeemed.event, 'Redeemed')
        assert.equal(Redeemed.args.from, user1)
        assert.equal(Redeemed.args.amount, toWei('3'))
      })
    })

    describe('withdrawCommittedDepositFrom(address,uint256)', () => {
      xit('should only be called by the token', async () => {
        await chai.assert.isRejected(pool.withdrawCommittedDepositFrom(user1, toWei('0')), /Pool\/only-token/)
      })
    })

    describe('withdraw()', () => {

      xit('should call the PoolToken', async () => {
        await token.approve(pool.address, TICKET_PRICE, { from: user1 })
        await pool.depositPool(TICKET_PRICE, { from: user1 })
        await poolContext.nextDraw()

        const poolToken = await poolContext.createToken()

        await pool.withdraw({ from: user1 })

        const [Redeemed, Transfer] = await poolToken.getPastEvents({fromBlock: 0, toBlock: 'latest'})

        // console.log(Redeemed)

        assert.equal(Redeemed.event, 'Redeemed')
        assert.equal(Redeemed.args.from, user1)
        assert.equal(Redeemed.args.amount, TICKET_PRICE.toString())
      })

      describe('with sponsorship', () => {
        beforeEach(async () => {
          await token.approve(pool.address, toWei('1000'), { from: user2 })
          await pool.depositSponsorship(toWei('1000'), { from: user2 })
        })
  
        xit('should allow the sponsor to withdraw partially', async () => {
          const user2BalanceBefore = await token.balanceOf(user2)
  
          await pool.withdraw({ from: user2 })
  
          assert.equal((await pool.totalBalanceOf(user2)).toString(), toWei('0'))
          const user2BalanceAfter = await token.balanceOf(user2)
          assert.equal(user2BalanceAfter.toString(), user2BalanceBefore.add(new BN(toWei('1000'))).toString())
        })
      })

      xit('should work for one participant', async () => {
        await token.approve(pool.address, TICKET_PRICE, { from: user1 })
        await pool.depositPool(TICKET_PRICE, { from: user1 })
        await poolContext.nextDraw()
        await poolContext.nextDraw()

        let balance = await pool.totalBalanceOf(user1)
        assert.equal(balance.toString(), toWei('12'))

        const balanceBefore = await token.balanceOf(user1)
        await pool.withdraw({ from: user1 })
        const balanceAfter = await token.balanceOf(user1)

        assert.equal(balanceAfter.toString(), (new BN(balanceBefore).add(balance)).toString())
      })

      xit('should work for two participants', async () => {

        await token.approve(pool.address, priceForTenTickets, { from: user1 })
        await pool.depositPool(priceForTenTickets, { from: user1 })

        await token.approve(pool.address, priceForTenTickets, { from: user2 })
        await pool.depositPool(priceForTenTickets, { from: user2 })

        assert.equal((await pool.openSupply()).toString(), toWei('200'))

        await poolContext.nextDraw()

        assert.equal((await pool.openSupply()).toString(), toWei('0'))
        assert.equal((await pool.committedSupply()).toString(), toWei('200'))

        const { Rewarded } = await poolContext.nextDraw()
        
        const user1BalanceBefore = await token.balanceOf(user1)
        await pool.withdraw({ from: user1 })
        const user1BalanceAfter = await token.balanceOf(user1)

        const user2BalanceBefore = await token.balanceOf(user2)        
        await pool.withdraw({ from: user2 })
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

      xit('should work when one user withdraws before the next draw', async () => {
        await token.approve(pool.address, priceForTenTickets, { from: user1 })
        await pool.depositPool(priceForTenTickets, { from: user1 })

        await token.approve(pool.address, priceForTenTickets, { from: user2 })
        await pool.depositPool(priceForTenTickets, { from: user2 })

        await poolContext.nextDraw()

        // pool is now committed and earning interest
        await pool.withdraw({ from: user2 })

        const { Rewarded } = await poolContext.nextDraw()

        // pool has been rewarded
        // earned interest will only be 20% of user1's ticket balance
        const earnedInterest = priceForTenTickets.mul(new BN(20)).div(new BN(100))

        assert.equal(Rewarded.args.winner, user1)
        assert.equal((await pool.totalBalanceOf(user1)).toString(), earnedInterest.add(priceForTenTickets).toString())
      })
    })

    describe('balanceOf()', () => {
      xit('should return the entrants total to withdraw', async () => {
        await token.approve(pool.address, TICKET_PRICE, { from: user1 })
        await pool.depositPool(TICKET_PRICE, { from: user1 })

        let balance = await pool.totalBalanceOf(user1)

        assert.equal(balance.toString(), TICKET_PRICE.toString())
      })
    })
  })

  describe('when fee fraction is greater than zero', () => {
    beforeEach(() => {
      /// Fee fraction is 10%
      feeFraction = web3.utils.toWei('0.1', 'ether')
    })

    xit('should reward the owner the fee', async () => {

      pool = await poolContext.createPool(feeFraction)

      const user1Tickets = TICKET_PRICE.mul(new BN(100))
      await token.approve(pool.address, user1Tickets, { from: user1 })
      await pool.depositPool(user1Tickets, { from: user1 })

      await poolContext.nextDraw()

      /// CErc20Mock awards 20% regardless of duration.
      const totalDeposit = user1Tickets
      const interestEarned = totalDeposit.mul(new BN(20)).div(new BN(100))
      const fee = interestEarned.mul(new BN(10)).div(new BN(100))

      // we expect unlocking to transfer the fee to the owner
      const { Rewarded } = await poolContext.nextDraw()

      assert.equal(Rewarded.args.fee.toString(), fee.toString())

      assert.equal((await pool.totalBalanceOf(owner)).toString(), fee.toString())

      // we expect the pool winner to receive the interest less the fee
      const user1Balance = await token.balanceOf(user1)
      await pool.withdraw({ from: user1 })
      const newUser1Balance = await token.balanceOf(user1)
      assert.equal(newUser1Balance.toString(), user1Balance.add(user1Tickets).add(interestEarned).sub(fee).toString())
    })
  })

  describe('when a pool is rewarded without a winner', () => {
    xit('should save the winnings for the next draw', async () => {

      // Here we create the pool and open the first draw
      pool = await poolContext.createPool(feeFraction)

      // Now we commit a draw, and open a new draw
      await poolContext.openNextDraw()

      // We deposit into the pool
      const depositAmount = web3.utils.toWei('100', 'ether')
      await token.approve(pool.address, depositAmount, { from: user1 })
      await pool.depositPool(depositAmount, { from: user1 })

      // The money market should have received this
      assert.equal(await poolContext.balance(), toWei('100'))

      // The pool is awarded interest, now should have deposit + 20%
      await moneyMarket.reward(pool.address)

      // The new balance should include 20%
      assert.equal(await poolContext.balance(), toWei('120'))

      // Now we reward the first committed draw.  There should be no winner, and the winnings should carry over
      await poolContext.rewardAndOpenNextDraw()

      // The user's balance should remain the same
      assert.equal((await pool.totalBalanceOf(user1)).toString(), depositAmount.toString())

      // Trigger the next block (only on testrpc!)
      await web3.eth.sendTransaction({ to: user1, from: user2, value: 1 })

      // Now even though there was no reward, the winnings should have carried over
      await poolContext.rewardAndOpenNextDraw()

      // The user's balance should include the winnings
      assert.equal((await pool.totalBalanceOf(user1)).toString(), web3.utils.toWei('120'))

    })
  })

  describe('when a pool reward overflows', () => {
    xit('should save the winnings for the next draw', async () => {
      // Here we create the pool and open the first draw
      pool = await poolContext.createPool(feeFraction)

      // We deposit into the pool
      const depositAmount = web3.utils.toWei('100', 'ether')
      await token.approve(pool.address, depositAmount, { from: user1 })
      await pool.depositPool(depositAmount, { from: user1 })

      // Now we commit a draw, and open a new draw.  User is committed
      await poolContext.openNextDraw()

      assert.equal((await pool.totalBalanceOf(user1)).toString(), depositAmount)

      const overflowReward = new BN(MAX_NEW_FIXED).add(new BN(web3.utils.toWei('99', 'ether'))).toString()

      // The pool is awarded max int + 100
      await moneyMarket.rewardCustom(pool.address, overflowReward)

      // the winnings should cap at the max new fixed value
      const { Rewarded } = await poolContext.rewardAndOpenNextDraw()

      assert.equal(Rewarded.event, 'Rewarded')
      assert.equal(Rewarded.args.winnings.toString(), MAX_NEW_FIXED)

      const userNewBalance = new BN(MAX_NEW_FIXED).add(new BN(web3.utils.toWei('100', 'ether'))).toString()
      // The user's balance should include the *max* int256
      assert.equal((await pool.totalBalanceOf(user1)).toString(), userNewBalance)
    })
  })

  describe('setNextFeeFraction()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
    })

    xit('should allow the owner to set the next fee fraction', async () => {
      await pool.setNextFeeFraction(toWei('0.05'))
      assert.equal((await pool.nextFeeFraction()).toString(), toWei('0.05'))
    })

    xit('should not allow anyone else to set the fee fraction', async () => {
      await chai.assert.isRejected(pool.setNextFeeFraction(toWei('0.05'), { from: user1 }), /Pool\/admin/)
    })

    xit('should require the fee fraction to be less than or equal to 1', async () => {
      // 1 is okay
      await pool.setNextFeeFraction(toWei('1'))
      await chai.assert.isRejected(pool.setNextFeeFraction(toWei('1.1')), /Pool\/less-1/)
    })
  })

  describe('setNextFeeBeneficiary()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
    })

    xit('should allow the owner to set the next fee fraction', async () => {
      await pool.setNextFeeBeneficiary(user1)
      assert.equal((await pool.nextFeeBeneficiary()).toString(), user1)
    })

    xit('should not allow anyone else to set the fee fraction', async () => {
      await chai.assert.isRejected(pool.setNextFeeBeneficiary(user1, { from: user1 }), /Pool\/admin/)
    })

    xit('should not allow the beneficiary to be zero', async () => {
      await chai.assert.isRejected(pool.setNextFeeBeneficiary(ZERO_ADDRESS), /Pool\/not-zero/)
    })
  })

  describe('pauseDeposits()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
      await poolContext.nextDraw()
    })

    xit('should not allow any more deposits', async () => {
      await pool.pauseDeposits()
      await chai.assert.isRejected(poolContext.depositPool(toWei('10'), { from: user2 }), /Pool\/d-paused/)
    })
  })

  describe('unpauseDeposits()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
    })

    xit('should not work unless paused', async () => {
      await chai.assert.isRejected(pool.unpauseDeposits(), /Pool\/d-not-paused/)
    })

    xit('should allow deposit after unpausing', async () => {
      await pool.pauseDeposits()
      await pool.unpauseDeposits()
      await poolContext.depositPool(toWei('10'), { from: user2 })
    })
  })

  describe('transferBalanceToSponsorship()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
    })

    xit('should transfer the balance of the pool in as sponsorship', async () => {
      await token.mint(pool.address, toWei('1000'))

      assert.equal(await token.balanceOf(pool.address), toWei('1000'))

      await pool.transferBalanceToSponsorship()

      assert.equal(await token.balanceOf(pool.address), toWei('0'))
      assert.equal(await pool.totalBalanceOf(pool.address), toWei('1000'))
      assert.equal(await pool.accountedBalance(), toWei('1000'))
      assert.equal((await pool.methods['balance()'].call()).toString(), toWei('1000'))
    })
  })
})
