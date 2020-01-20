const chai = require('./helpers/chai')
const Blocklock = artifacts.require('Blocklock.sol')
const ExposedBlocklock = artifacts.require('ExposedBlocklock.sol')
const toWei = require('./helpers/toWei')
const fromWei = require('./helpers/fromWei')

contract('Blocklock', (accounts) => {

  let blocklock

  let lockDuration = 3
  let cooldownDuration = 7

  beforeEach(async () => {
    const lib = await Blocklock.new()
    ExposedBlocklock.link('Blocklock', lib.address)
    blocklock = await ExposedBlocklock.new()
    await blocklock.setLockDuration(3)
    await blocklock.setCooldownDuration(7)
  })

  describe('setLockDuration()', () => {
    it('should set the durations correctly', async () => {
      await blocklock.setLockDuration(10)

      expect(await blocklock.lockDuration(), 10)
    })

    it('should require numbers greater than zero', async () => {
      await chai.assert.isRejected(blocklock.setLockDuration(0), /Blocklock\/lock-min/)
    })
  })

  describe('setCooldownDuration()', () => {
    it('should set the durations correctly', async () => {
      await blocklock.setCooldownDuration(10)
      expect(await blocklock.cooldownDuration(), 10)
    })

    it('should not accept zero', async () => {
      await chai.assert.isRejected(blocklock.setCooldownDuration(0), /Blocklock\/cool-min/)
    })
  })

  describe('isLocked()', () => {
    it('should be false when lockedAt is not set', async () => {
      chai.expect(await blocklock.isLocked(0)).to.be.false
    })

    it('should be true when the blocklock is locked', async () => {
      let blockNumber = 10
      await blocklock.lock(blockNumber)

      // includes block itself
      chai.expect(await blocklock.isLocked(blockNumber)).to.be.true

      chai.expect(await blocklock.isLocked(blockNumber + lockDuration - 1)).to.be.true

      // excluding last block
      chai.expect(await blocklock.isLocked(blockNumber + lockDuration)).to.be.false
    })
  })

  describe('cooldownEndAt()', () => {
    it('should return when the cooldown ends', async () => {
      let blockNumber = 1
      await blocklock.lock(blockNumber)
      chai.expect((await blocklock.cooldownEndAt()).toString()).to.equal('11')
    })
  })

  describe('lockEndAt()', () => {
    it('should return when the lock ends', async () => {
      let blockNumber = 1
      await blocklock.lock(blockNumber)
      chai.expect((await blocklock.lockEndAt()).toString()).to.equal('4')
    })
  })

  describe('canLock()', () => {
    it('should be true if unlocked', async () => {
      let blockNumber = 1
      chai.expect(await blocklock.canLock(blockNumber)).to.be.true
    })

    it('should be false if locked', async () => {
      let blockNumber = 1
      await blocklock.lock(blockNumber)
      chai.expect(await blocklock.canLock(blockNumber)).to.be.false
    })

    it('should be true if after cooldown period', async () => {
      let blockNumber = 1
      await blocklock.lock(blockNumber)
      chai.expect(await blocklock.canLock(blockNumber + lockDuration + cooldownDuration - 1)).to.be.false
      chai.expect(await blocklock.canLock(blockNumber + lockDuration + cooldownDuration)).to.be.true
    })
  })

  describe('unlock()', () => {
    it('should be able to unlock early', async () => {
      let blockNumber = 1
      await blocklock.lock(blockNumber)
      chai.expect(await blocklock.isLocked(blockNumber)).to.be.true

      await blocklock.unlock(blockNumber)
      chai.expect(await blocklock.isLocked(blockNumber)).to.be.false
    })

    it('should ignore unlock time when earlier than the lock time', async () => {
      let blockNumber = 1
      await blocklock.lock(blockNumber)
      chai.expect(await blocklock.isLocked(blockNumber)).to.be.true

      // set an earlier unlock time.  Doesn't matter then.
      await blocklock.unlock(blockNumber - 1)
      chai.expect(await blocklock.isLocked(blockNumber)).to.be.true
    })
  })

  describe('lock()', () => {
    it('should lock', async () => {
      let blockNumber = 1
      await blocklock.lock(blockNumber)
      chai.expect(await blocklock.isLocked(blockNumber)).to.be.true
    })

    it('should expire', async () => {
      let blockNumber = 1
      await blocklock.lock(blockNumber)
      chai.expect(await blocklock.isLocked(blockNumber + lockDuration)).to.be.false
    })

    it('should require the cooldown to expire before locking again', async () => {
      let blockNumber = 1
      await blocklock.lock(blockNumber)

      await chai.assert.isRejected(blocklock.lock(blockNumber + lockDuration + cooldownDuration - 1), /Blocklock\/no-lock/)

      let newBlockNumber = blockNumber + lockDuration + cooldownDuration
      await blocklock.lock(newBlockNumber)
      chai.expect(await blocklock.isLocked(newBlockNumber)).to.be.true
    })
  })
})
