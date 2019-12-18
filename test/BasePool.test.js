const toWei = require('./helpers/toWei')
const fromWei = require('./helpers/fromWei')
const chai = require('./helpers/chai')
const PoolContext = require('./helpers/PoolContext')
const setupERC1820 = require('./helpers/setupERC1820')
const BN = require('bn.js')
const Pool = artifacts.require('MCDAwarePool.sol')
const {
  SECRET,
  SALT,
  SECRET_HASH,
  ZERO_ADDRESS,
  TICKET_PRICE
} = require('./helpers/constants')

const debug = require('debug')('Pool.test.js')

contract('BasePool', (accounts) => {
  let pool, token, moneyMarket
  
  const [owner, admin, user1, user2] = accounts

  const priceForTenTickets = TICKET_PRICE.mul(new BN(10))

  let feeFraction, contracts

  let poolContext = new PoolContext({ web3, artifacts, accounts })

  beforeEach(async () => {
    feeFraction = new BN('0')
    await setupERC1820({ web3, artifacts, account: owner })
    contracts = await poolContext.init()
    token = contracts.token
    moneyMarket = contracts.moneyMarket
    await Pool.link("DrawManager", contracts.drawManager.address)
    await Pool.link("FixidityLib", contracts.fixidity.address)
    await Pool.link("Blocklock", contracts.blocklock.address)
  })

  describe('init()', () => {
    it('should fail if owner is zero', async () => {
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

    it('should fail if moneymarket is zero', async () => {
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

    it('should allow an admin to add another', async () => {
      await pool.addAdmin(user1)
      assert.ok(await pool.isAdmin(user1))
    })

    it('should not allow a non-admin to remove an admin', async () => {
      await chai.assert.isRejected(pool.addAdmin(user2, { from: user1 }), /Pool\/admin/)
    })
  })

  describe('removeAdmin()', () =>{
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
      await pool.addAdmin(user1)
    })

    it('should allow an admin to remove another', async () => {
      await pool.removeAdmin(user1)
      assert.ok(!(await pool.isAdmin(user1)))
    })

    it('should not allow a non-admin to remove an admin', async () => {
      await chai.assert.isRejected(pool.removeAdmin(user1, { from: admin }), /Pool\/admin/)
    })

    it('should not an admin to remove an non-admin', async () => {
      await chai.assert.isRejected(pool.removeAdmin(user2), /Pool\/no-admin/)
    })

    it('should not allow an admin to remove themselves', async () => {
      await chai.assert.isRejected(pool.removeAdmin(owner), /Pool\/remove-self/)
    })
  })

  describe('supplyRatePerBlock()', () => {
    it('should work', async () => {
      pool = await poolContext.createPool(feeFraction) // ten blocks long
      assert.equal(await pool.supplyRatePerBlock(), web3.utils.toWei('0.1', 'ether'))
    })
  })

  describe('committedBalanceOf()', () => {
    it('should return the users balance for the current draw', async () => {
      pool = await poolContext.createPool(feeFraction)

      await poolContext.depositPool(TICKET_PRICE, { from: user1 })

      assert.equal((await pool.committedBalanceOf(user1)).toString(), '0')

      await poolContext.nextDraw()

      assert.equal(await pool.committedBalanceOf(user1), TICKET_PRICE.toString())
    })
  })

  describe('openBalanceOf()', () => {
    it('should return the users balance for the current draw', async () => {
      pool = await poolContext.createPool(feeFraction)

      await token.approve(pool.address, TICKET_PRICE, { from: user1 })
      await pool.depositPool(TICKET_PRICE, { from: user1 })

      assert.equal((await pool.openBalanceOf(user1)).toString(), TICKET_PRICE.toString())

      await poolContext.nextDraw()

      assert.equal(await pool.openBalanceOf(user1), '0')
    })
  })

  describe('estimatedInterestRate()', () => {
    it('should set an appropriate limit based on max integers', async () => {
      pool = await poolContext.createPool(feeFraction) // ten blocks long

      const interestRate = await pool.estimatedInterestRate(10);
      assert.equal(interestRate.toString(), '1000000000000000000')
    })
  })

  describe('getDraw()', () => {
    it('should return empty values if no draw exists', async () => {
      pool = await poolContext.createPool(feeFraction)
      const draw = await pool.getDraw(12)
      assert.equal(draw.feeFraction, '0')
      assert.equal(draw.feeBeneficiary, ZERO_ADDRESS)
      assert.equal(draw.openedBlock, '0')
      assert.equal(draw.secretHash, '0x0000000000000000000000000000000000000000000000000000000000000000')
    })

    it('should return true values if a draw exists', async () => {
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

    it('should have opened a draw', async () => {
      assert.equal(await pool.currentOpenDrawId(), '1')
      const events = await pool.getPastEvents()
      assert.equal(events.length, 1)
      const firstEvent = events[0]
      assert.equal(firstEvent.event, 'Opened')
      const { drawId } = firstEvent.args
      assert.equal(drawId, '1')
    })

    it('should emit a committed event', async () => {
      const tx = await pool.openNextDraw(SECRET_HASH) // now has a committed draw

      const [Committed, Opened] = tx.logs
      assert.equal(Committed.event, 'Committed')
      assert.equal(Committed.args.drawId, '1')
      assert.equal(Opened.event, 'Opened')
      assert.equal(Opened.args.drawId, '2')
    })

    it('should revert when the committed draw has not been rewarded', async () => {
      await pool.openNextDraw(SECRET_HASH)
      await chai.assert.isRejected(pool.openNextDraw(SECRET_HASH), /Pool\/not-reward/)
    })

    it('should succeed when the committed draw has been rewarded', async () => {
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

    it('should fail if there is no committed draw', async () => {
      await pool.lockTokens()
      await chai.assert.isRejected(pool.reward(SECRET, SALT), /Pool\/committed/)
    })

    it('should fail if the committed draw has already been rewarded', async () => {
      await poolContext.nextDraw()
      await pool.lockTokens()
      await pool.reward(SECRET, SALT)
      await pool.lockTokens()
      await chai.assert.isRejected(pool.reward(SECRET, SALT), /Pool\/already/)
    })

    it('should fail if the secret does not match', async () => {
      await pool.openNextDraw(SECRET_HASH) // now committed and open
      await pool.lockTokens()
      await chai.assert.isRejected(pool.reward('0xdeadbeef', SALT), /Pool\/bad-secret/)
    })

    it('should award the interest to the winner', async () => {
      await poolContext.depositPool(toWei('10'), { from: user1 })
      await pool.openNextDraw(SECRET_HASH) // now committed and open
      await moneyMarket.reward(pool.address)
      await pool.lockTokens()
      await pool.reward(SECRET, SALT) // reward winnings to user1 and fee to owner
      assert.equal(await pool.balanceOf(user1), toWei('10'))
      assert.equal(await pool.openBalanceOf(user1), toWei('2'))
    })

    it('can only be run by an admin', async () => {
      await pool.openNextDraw(SECRET_HASH) // now committed and open
      await chai.assert.isRejected(pool.reward(SECRET, SALT, { from: user1 }), /Pool\/admin/)
    })
  })

  describe('rolloverAndOpenNextDraw()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
    })

    it('should not run if there is no committed draw', async () => {
      await chai.assert.isRejected(pool.rolloverAndOpenNextDraw(SECRET_HASH), /Pool\/committed/)
    })

    it('should not run if the committed draw has already been rewarded', async () => {
      // the committed draw has already been rewarded
      await poolContext.nextDraw() // have an open draw and committed draw
      await pool.lockTokens()
      await pool.reward(SECRET, SALT)
      await chai.assert.isRejected(pool.rolloverAndOpenNextDraw(SECRET_HASH), /Pool\/already/)
    })

    it('should only be run by an admin', async () => {
      await poolContext.nextDraw()
      await chai.assert.isRejected(pool.rolloverAndOpenNextDraw(SECRET_HASH, { from: user1 }), /Pool\/admin/)
    })

    it('should rollover the draw and open the next', async () => {
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

    it('should only be called by admin', async () => {
      await pool.openNextDraw(SECRET_HASH) // now have committed
      await chai.assert.isRejected(pool.rollover({from: user1}), /Pool\/admin/)
    })

    it('should not run if there is no committed draw', async () => {
      await chai.assert.isRejected(pool.rollover(), /Pool\/committed/)
    })

    it('should not run if the committed draw has been rewarded', async () => {
      // the committed draw has already been rewarded
      await poolContext.nextDraw() // have an open draw and committed draw
      await pool.lockTokens()
      await pool.reward(SECRET, SALT)
      await chai.assert.isRejected(pool.rollover(), /Pool\/already/)
    })

    it('should reward the pool with 0', async () => {
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

    it('should lock the pool', async () => {
      assert.equal(await pool.isLocked(), false)
      await pool.lockTokens()
      assert.equal(await pool.isLocked(), true)
    })

    it('should only be called by the admin', async () => {
      await chai.assert.isRejected(pool.lockTokens({ from: user1 }), /Pool\/admin/)
    })
  })

  describe('lockDuration()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction, 12)
    })

    it('should return the lock duration', async () => {
      assert.equal(await pool.lockDuration(), '2')
    })
  })

  describe('cooldownDuration()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction, 12)
    })

    it('should return the cooldown duration', async () => {
      assert.equal(await pool.cooldownDuration(), '12')
    })
  })

  describe('unlockTokens()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
      await pool.lockTokens()  
    })

    it('should unlock the pool', async () => {
      await pool.unlockTokens()  
      assert.equal(await pool.isLocked(), false)
    })

    it('should only be called by the admin', async () => {
      await chai.assert.isRejected(pool.unlockTokens({ from: user1 }), /Pool\/admin/)
    })
  })

  describe('rewardAndOpenNextDraw()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
    })

    it('should revert if the pool isnt locked', async () => {
      await chai.assert.isRejected(pool.rewardAndOpenNextDraw(SECRET_HASH, SECRET, SALT), /Pool\/unlocked/)
    })

    it('should revert if there is no committed draw', async () => {
      await pool.lockTokens()
      await chai.assert.isRejected(pool.rewardAndOpenNextDraw(SECRET_HASH, SECRET, SALT), /Pool\/committed/)
    })

    it('should fail if the secret does not match', async () => {
      await pool.openNextDraw(SECRET_HASH)
      await pool.lockTokens()
      await chai.assert.isRejected(pool.rewardAndOpenNextDraw(SECRET_HASH, SALT, SECRET), /Pool\/bad-secret/)
    })
  })

  describe('depositPool()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPoolNoOpenDraw()
    })

    it('should fail if there is no open draw', async () => {
      await token.approve(pool.address, TICKET_PRICE, { from: user1 })

      await chai.assert.isRejected(pool.depositPool(TICKET_PRICE, { from: user1 }), /Pool\/no-open/)
    })
  })

  describe('with a fresh pool', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
    })

    describe('depositPool()', () => {
      it('should fail if not enough tokens approved', async () => {
        await token.approve(pool.address, TICKET_PRICE.div(new BN(2)), { from: user1 })
        await chai.assert.isRejected(pool.depositPool(TICKET_PRICE, { from: user1 }))
      })

      it('should deposit some tokens into the pool', async () => {
        await token.approve(pool.address, TICKET_PRICE, { from: user1 })

        const response = await pool.depositPool(TICKET_PRICE, { from: user1 })
        const deposited = response.receipt.logs[response.receipt.logs.length - 1]
        assert.equal(deposited.event, 'Deposited')
        assert.equal(deposited.address, pool.address)
        assert.equal(deposited.args[0], user1)
        assert.equal(deposited.args[1].toString(), toWei('10'))
      })

      it('should allow multiple deposits', async () => {
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

      it('should contribute to the winnings', async () => {
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
      it('should withdraw the sponsorship and any fees they have taken', async () => {
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

      it('does not allow a withdrawal when their balance is zero', async () => {
        await chai.assert.isRejected(pool.withdrawSponsorshipAndFee(toWei('500'), { from: user2 }), /Pool\/exceeds-sfee/)
      })

      it('does not allow a withdrawal that exceeds their balance', async () => {
        await token.approve(pool.address, toWei('1000'), { from: user2 })
        await pool.depositSponsorship(toWei('1000'), { from: user2 })
        await chai.assert.isRejected(pool.withdrawSponsorshipAndFee(toWei('1000.01'), { from: user2 }), /Pool\/exceeds-sfee/)
      })
    })

    describe('withdrawOpenDeposit()', () => {
      it('should allow a user to withdraw their open deposit', async () => {
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

      it('should allow a user to partially withdraw their open deposit', async () => {
        await token.approve(pool.address, toWei('10'), { from: user1 })
        await pool.depositPool(toWei('10'), { from: user1 })
        assert.equal(await pool.openBalanceOf(user1), toWei('10'))
        await pool.withdrawOpenDeposit(toWei('6'), { from: user1 })
        assert.equal(await pool.openBalanceOf(user1), toWei('4'))
      })

      it('should not allow a user to withdraw more than their open deposit', async () => {
        await chai.assert.isRejected(pool.withdrawOpenDeposit(toWei('6'), { from: user1 }), /DrawMan\/exceeds-open/)
      })
    })

    describe('withdrawCommittedDeposit()', () => {
      it('should allow a user to withdraw their committed deposit', async () => {
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

      it('should call burn on the poolToken if available', async () => {
        let poolToken = await poolContext.createToken()

        await token.approve(pool.address, toWei('10'), { from: user1 })
        await pool.depositPool(toWei('10'), { from: user1 })
        await poolContext.nextDraw()

        await pool.withdrawCommittedDeposit(toWei('3'), { from: user1 })

        const [Redeemed, Transfer] = await poolToken.getPastEvents({fromBlock: 0, toBlock: 'latest'})

        assert.equal(Redeemed.event, 'Redeemed')
        assert.equal(Redeemed.args.from, user1)
        assert.equal(Redeemed.args.amount, toWei('3'))
      })
    })

    describe('withdrawCommittedDeposit(address,uint256)', () => {
      it('should only be called by the token', async () => {
        await chai.assert.isRejected(pool.withdrawCommittedDeposit(user1, toWei('0')), /Pool\/only-token/)  
      })
    })

    describe('withdraw()', () => {

      it('should call the PoolToken', async () => {
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
  
        it('should allow the sponsor to withdraw partially', async () => {
          const user2BalanceBefore = await token.balanceOf(user2)
  
          await pool.withdraw({ from: user2 })
  
          assert.equal((await pool.totalBalanceOf(user2)).toString(), toWei('0'))
          const user2BalanceAfter = await token.balanceOf(user2)
          assert.equal(user2BalanceAfter.toString(), user2BalanceBefore.add(new BN(toWei('1000'))).toString())
        })
      })

      it('should work for one participant', async () => {
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

      it('should work for two participants', async () => {

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

      it('should work when one user withdraws before the next draw', async () => {
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
      it('should return the entrants total to withdraw', async () => {
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

    it('should reward the owner the fee', async () => {

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
    it('should save the winnings for the next draw', async () => {

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

      // Now even though there was no reward, the winnings should have carried over
      await poolContext.rewardAndOpenNextDraw()

      // The user's balance should include the winnings
      assert.equal((await pool.totalBalanceOf(user1)).toString(), web3.utils.toWei('120'))

    })
  })

  describe('setNextFeeFraction()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
    })

    it('should allow the owner to set the next fee fraction', async () => {
      await pool.setNextFeeFraction(toWei('0.05'))
      assert.equal((await pool.nextFeeFraction()).toString(), toWei('0.05'))
    })

    it('should not allow anyone else to set the fee fraction', async () => {
      await chai.assert.isRejected(pool.setNextFeeFraction(toWei('0.05'), { from: user1 }), /Pool\/admin/)
    })

    it('should require the fee fraction to be less than or equal to 1', async () => {
      // 1 is okay
      await pool.setNextFeeFraction(toWei('1'))
      await chai.assert.isRejected(pool.setNextFeeFraction(toWei('1.1')), /Pool\/less-1/)
    })
  })

  describe('setNextFeeBeneficiary()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
    })

    it('should allow the owner to set the next fee fraction', async () => {
      await pool.setNextFeeBeneficiary(user1)
      assert.equal((await pool.nextFeeBeneficiary()).toString(), user1)
    })

    it('should not allow anyone else to set the fee fraction', async () => {
      await chai.assert.isRejected(pool.setNextFeeBeneficiary(user1, { from: user1 }), /Pool\/admin/)
    })

    it('should not allow the beneficiary to be zero', async () => {
      await chai.assert.isRejected(pool.setNextFeeBeneficiary(ZERO_ADDRESS), /Pool\/not-zero/)
    })
  })

  describe('pause()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
      await poolContext.nextDraw()
    })

    it('should not allow any more deposits', async () => {
      await pool.pause()
      await chai.assert.isRejected(poolContext.depositPool(toWei('10'), { from: user2 }), /Pool\/not-paused/)
    })
  })

  describe('unpause()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
    })

    it('should not work unless paused', async () => {
      await chai.assert.isRejected(pool.unpause(), /Pool\/be-paused/)
    })

    it('should allow deposit after unpausing', async () => {
      await pool.pause()
      await pool.unpause()
      await poolContext.depositPool(toWei('10'), { from: user2 })
    })
  })

  describe('transferBalanceToSponsorship()', () => {
    beforeEach(async () => {
      pool = await poolContext.createPool(feeFraction)
    })

    it('should transfer the balance of the pool in as sponsorship', async () => {
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
