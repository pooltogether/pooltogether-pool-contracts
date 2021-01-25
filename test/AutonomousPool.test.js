const toWei = require('./helpers/toWei')
const chai = require('./helpers/chai')
const { expect } = chai
const PoolContext = require('./helpers/PoolContext')
const setupERC1820 = require('./helpers/setupERC1820')
const BN = require('bn.js')
const AutonomousPoolHarness = artifacts.require('AutonomousPoolHarness.sol')
const MockComptroller = artifacts.require('MockComptroller.sol')
const Token = artifacts.require('Token.sol')
const {
  ZERO_ADDRESS
} = require('./helpers/constants')

const REWARD_LISTENER_INTERFACE_HASH = web3.utils.soliditySha3('PoolTogetherRewardListener')

contract('BasePool', (accounts) => {
  let pool, token, moneyMarket
  
  const [owner, admin, user1, user2] = accounts

  let feeFraction, contracts

  let poolContext = new PoolContext({ web3, artifacts, accounts })

  let comp, comptroller

  beforeEach(async () => {
    // reset the users interface implementer
    registry = await setupERC1820({ web3, artifacts, account: owner })
    await registry.setInterfaceImplementer(user1, REWARD_LISTENER_INTERFACE_HASH, ZERO_ADDRESS, { from: user1 })
    comp = await Token.new()
    await comp.initialize(owner, "name", "symbol", 18)

    comptroller = await MockComptroller.new(comp.address)

    feeFraction = new BN('0')
    await poolContext.init({ poolArtifact: AutonomousPoolHarness })
    contracts = poolContext
    token = contracts.token
    moneyMarket = contracts.moneyMarket

    pool = await poolContext.createPoolNoOpenDraw(feeFraction)
    // non-admin can initialize
    await pool.initializeAutonomousPool(10, 100, comp.address, comptroller.address, { from: user2 })
  })

  describe('initializeAutonomousPool', () => {
    it('should set the prize period', async () => {

      expect((await pool.lastAwardTimestamp()).toString()).to.equal('10')
      expect((await pool.prizePeriodSeconds()).toString()).to.equal('100')
      expect((await pool.comptroller())).to.equal(comptroller.address)
      expect((await pool.comp())).to.equal(comp.address)
    })

    it('should allow admins to call again after initialized', async () => {
      await pool.initializeAutonomousPool(22, 222, comp.address, comptroller.address, { from: owner })
      expect((await pool.lastAwardTimestamp()).toString()).to.equal('22')
      expect((await pool.prizePeriodSeconds()).toString()).to.equal('222')
    })

    it('should allow admins to call again after initialized', async () => {
      await chai.assert.isRejected(pool.initializeAutonomousPool(22, 222, comp.address, comptroller.address, { from: user2 }), "AutonomousPool/only-init-or-admin")
    })

    it('should send all COMP to the gnosis safe', async () => {
      pool = await poolContext.createPoolNoOpenDraw(feeFraction)

      await comp.mint(comptroller.address, toWei('11'))
      await comp.mint(pool.address, toWei('9'))
      await pool.initializeAutonomousPool(10, 100, comp.address, comptroller.address, { from: user2 })

      expect((await comp.balanceOf("0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f")).toString()).to.equal(toWei('20'))
    })
  })

  describe('lockTokens()', () => {
    it('should not allowing locking when the pool hasnt been init', async () => {
      await pool.setCurrentTime('0')
      await chai.assert.isRejected(pool.lockTokens(), /AutonomousPool\/prize-period-not-ended/)
    })

    it('should not allowing locking before the prize period has elapsed', async () => {
      await pool.setCurrentTime('10')
      await chai.assert.isRejected(pool.lockTokens(), /AutonomousPool\/prize-period-not-ended/)
    })

    it('should allow anyone to lock the tokens once the prize period has elapsed', async () => {
      await pool.setCurrentTime('110') // set to start + 100 seconds
      await pool.lockTokens({ from: user2 })
      expect(await pool.isLocked()).to.be.true
      expect(await pool.nextRewardRecipient()).to.equal(user2)
    })
  })

  describe('reward()', () => {
    beforeEach(async () => {
      await pool.setCurrentTime('110') // set to start + 100 seconds
    })

    it('should not reward unless the pool is locked', async () => {
      await chai.assert.isRejected(pool.reward(), /Pool\/unlocked/)
    })

    it('should correctly open the first draw', async () => {
      expect((await pool.currentOpenDrawId()).toString()).to.equal('0')
      expect((await pool.currentCommittedDrawId()).toString()).to.equal('0')

      await pool.lockTokens()      
      await pool.methods['reward()']()
      
      expect((await pool.nextAwardAt()).toString()).to.equal('210')
      expect((await pool.currentOpenDrawId()).toString()).to.equal('1')
      expect((await pool.currentCommittedDrawId()).toString()).to.equal('0')
    })

    it('should correctly open the second draw', async () => {
      await pool.lockTokens()      
      await pool.methods['reward()']()

      await pool.setCurrentTime('210')

      await pool.lockTokens()      
      await pool.methods['reward()']()
      
      expect((await pool.nextAwardAt()).toString()).to.equal('310')
      expect((await pool.currentOpenDrawId()).toString()).to.equal('2')
      expect((await pool.currentCommittedDrawId()).toString()).to.equal('1')
    })

    it('should correctly reward on the third draw', async () => {
      await pool.lockTokens()      
      await pool.methods['reward()']()

      await pool.setCurrentTime('210')

      await pool.lockTokens()      
      await pool.methods['reward()']()

      await pool.setCurrentTime('310')

      await pool.lockTokens({ from: user2 })
      let tx = await pool.methods['reward()']()
      let rewarded = tx.logs.find(log => log.event === 'Rewarded')

      let block = await web3.eth.getBlock(rewarded.blockNumber - 1)
      expect(rewarded.args.entropy).to.equal(block.hash)

      expect((await pool.nextAwardAt()).toString()).to.equal('410')
      expect((await pool.currentOpenDrawId()).toString()).to.equal('3')
      expect((await pool.currentCommittedDrawId()).toString()).to.equal('2')
    })

    it('should transfer any comp claimed', async () => {

      await comp.mint(comptroller.address, toWei('100'))

      await pool.lockTokens({ from: user2 })
      await pool.methods['reward()']({ from: user2 })

      expect((await comp.balanceOf(user2)).toString()).to.equal(toWei('100'))
    })
  })

  describe('claimCOMP()', () => {
    it('should return the COMP award', async () => {
      await comp.mint(comptroller.address, toWei('11'))
      expect((await pool.claimCOMP.call()).toString()).to.equal(toWei('11'))
    })
  })

  describe('calculateFeeReward()', () => {
    it('should calculate the fee that will be paid to the awarder', async () => {
      await moneyMarket.rewardCustom(pool.address, toWei('10'))
      expect((await pool.calculateFeeReward.call()).toString()).to.equal(toWei('0'))

      await pool.setNextFeeFraction(toWei('0.1'))

      // open first draw
      await pool.setCurrentTime('110')
      await pool.lockTokens()
      await pool.reward()

      // open second draw && commit first
      await pool.setCurrentTime('210')
      await pool.lockTokens()
      await pool.reward()

      await moneyMarket.rewardCustom(pool.address, toWei('20'))
      expect((await pool.calculateFeeReward.call()).toString()).to.equal(toWei('3')) // 10 % of 30

      // reward first draw
      await pool.setCurrentTime('310')
      await pool.lockTokens()
      await pool.reward()

      expect((await pool.calculateFeeReward.call()).toString()).to.equal(toWei('2.7')) // 10% of 27
    })
  })

  describe('setNextFeeBeneficiary()', () => {
    it('should not be supported', async () => {
      await chai.assert.isRejected(pool.setNextFeeBeneficiary(owner), "AutonomousPool/not-supported")
    })
  })

  describe('disableAdminPermanently()', () => {
    it('should not be called by a non-admin', async () => {
      await chai.assert.isRejected(pool.disableAdminPermanently({ from: user2 }), /Pool\/admin/)
    })

    it('should disable all admin functions when called', async () => {
      await pool.setNextFeeFraction('2')
      await pool.disableAdminPermanently()
      await chai.assert.isRejected(pool.disableAdminPermanently(), /Pool\/admin-disabled/)
      await chai.assert.isRejected(pool.setNextFeeFraction('1'), /Pool\/admin-disabled/)
    })
  })

})
