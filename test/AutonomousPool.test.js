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

const SAFE_ADDRESS = "0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f"

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
    await pool.setCurrentTime(10)
    await pool.initializeAutonomousPool(100, comp.address, comptroller.address, { from: user2 })
  })

  describe('initializeAutonomousPool', () => {
    it('should set the prize period', async () => {
      expect((await pool.lastAwardTimestamp()).toString()).to.equal('10')
      expect((await pool.prizePeriodSeconds()).toString()).to.equal('100')
      expect((await pool.comptroller())).to.equal(comptroller.address)
      expect((await pool.comp())).to.equal(comp.address)
    })

    it('should not be called again', async () => {
      await chai.assert.isRejected(pool.initializeAutonomousPool(222, comp.address, comptroller.address, { from: user2 }), /AutonomousPool\/already-init/)
    })
  })

  describe('lockTokens()', () => {
    it('should not allow locking when the pool hasnt been init', async () => {
      await pool.setCurrentTime('0')
      await chai.assert.isRejected(pool.lockTokens(), /AutonomousPool\/prize-period-not-ended/)
    })

    it('should not allow locking before the prize period has elapsed', async () => {
      await pool.setCurrentTime('10')
      await chai.assert.isRejected(pool.lockTokens(), /AutonomousPool\/prize-period-not-ended/)
    })

    it('should allow anyone to lock the tokens once the prize period has elapsed', async () => {
      await pool.setCurrentTime('110') // set to start + 100 seconds
      await pool.lockTokens({ from: user2 })
      expect(await pool.isLocked()).to.be.true
    })
  })

  describe('reward()', () => {
    beforeEach(async () => {
      await pool.setCurrentTime('110') // set to start + 100 seconds
    })

    it('should not reward unless the pool is locked', async () => {
      await chai.assert.isRejected(pool.completeAward(), /Pool\/unlocked/)
    })

    it('should correctly open the first draw', async () => {
      expect((await pool.currentOpenDrawId()).toString()).to.equal('0')
      expect((await pool.currentCommittedDrawId()).toString()).to.equal('0')

      await pool.startAward()      
      await pool.completeAward()
      
      expect((await pool.nextAwardAt()).toString()).to.equal('210')
      expect((await pool.currentOpenDrawId()).toString()).to.equal('1')
      expect((await pool.currentCommittedDrawId()).toString()).to.equal('0')
    })

    it('should correctly open the second draw', async () => {
      await pool.startAward()      
      await pool.completeAward()

      await pool.setCurrentTime('210')

      await pool.startAward()      
      await pool.completeAward()
      
      expect((await pool.nextAwardAt()).toString()).to.equal('310')
      expect((await pool.currentOpenDrawId()).toString()).to.equal('2')
      expect((await pool.currentCommittedDrawId()).toString()).to.equal('1')
    })

    it('should correctly reward on the third draw', async () => {
      await pool.startAward()      
      await pool.completeAward()

      await pool.setCurrentTime('210')

      await pool.startAward()      
      await pool.completeAward()

      await pool.setCurrentTime('310')

      await pool.lockTokens({ from: user2 })
      let tx = await pool.completeAward()
      let rewarded = tx.logs.find(log => log.event === 'Rewarded')

      let block = await web3.eth.getBlock(rewarded.blockNumber - 1)
      expect(rewarded.args.entropy).to.equal(block.hash)

      expect((await pool.nextAwardAt()).toString()).to.equal('410')
      expect((await pool.currentOpenDrawId()).toString()).to.equal('3')
      expect((await pool.currentCommittedDrawId()).toString()).to.equal('2')
    })
  })

  describe('claimAndTransferCOMP()', () => {
    it('should do nothing if no recipient', async () => {
      await comp.mint(comptroller.address, toWei('11'))
      expect((await pool.claimAndTransferCOMP.call()).toString()).to.equal(toWei('0'))
      await pool.claimAndTransferCOMP()
      expect((await comp.balanceOf(SAFE_ADDRESS)).toString()).to.equal(toWei('0'))
    })

    it('should return the COMP award', async () => {
      await comp.mint(comptroller.address, toWei('11'))
      await pool.setCompRecipient(SAFE_ADDRESS)
      expect((await pool.claimAndTransferCOMP.call()).toString()).to.equal(toWei('11'))
      await pool.claimAndTransferCOMP()
      expect((await comp.balanceOf(SAFE_ADDRESS)).toString()).to.equal(toWei('11'))
    })
  })
})
