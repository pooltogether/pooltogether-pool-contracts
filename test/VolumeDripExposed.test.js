const { call } = require('./helpers/call')
const { ethers } = require('ethers')
const { expect } = require('chai')
const hardhat = require('hardhat')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:VolumeDripExposed.test')


describe('VolumeDripExposed', function() {

  let drip

  const overrides = { gasLimit: 9500000 }
  const periodSeconds = 10
  const dripAmount = toWei('10')
  const endTime = 30
  const unlimitedTokens = toWei('10000000')

  beforeEach(async () => {
    [wallet, wallet2, wallet3, wallet4] = await hardhat.ethers.getSigners()
    const VolumeDripExposed = await hre.ethers.getContractFactory("VolumeDripExposed", wallet, overrides)
    drip = await VolumeDripExposed.deploy()

    debug({ drip: drip.address })

    await drip.setNewPeriod(periodSeconds, dripAmount, endTime)
  })

  describe('setNewPeriod()', () => {
    it('should set the params and start the first period', async () => {
      let info = await drip.getDrip();
      expect(info.periodSeconds).to.equal(periodSeconds)
      expect(info.dripAmount).to.equal(dripAmount)

      let period = await drip.getPeriod('1')
      expect(period.endTime).to.equal(endTime)
    })
  })

  describe('setNextPeriod()', () => {
    it('should set the values for the next period', async () => {
      const newPeriodLength = 5
      const newDripAmount = toWei('10')

      await drip.setNextPeriod(newPeriodLength, newDripAmount)

      // ensure there is a deposit for the first period
      await drip.mint(wallet.address, toWei('11'))

      await expect(
        drip.drip(endTime, unlimitedTokens)
      )
        .to.emit(drip, 'MintedTotalSupply')
        .withArgs(dripAmount)

      // ensure there is a deposit for the next period
      await drip.mint(wallet.address, toWei('11'))

      await expect(
        drip.drip(endTime + newPeriodLength, unlimitedTokens)
      )
        .to.emit(drip, 'MintedTotalSupply')
        .withArgs(newDripAmount)
    })
  })

  describe('drip()', () => {
    it('should not drip anything if there were no deposits', async () => {
      await expect(
        drip.drip(endTime, unlimitedTokens)
      )
        .to.emit(drip, 'MintedTotalSupply')
        .withArgs('0')

      const nextPeriod = await drip.getPeriod(2)
      expect(nextPeriod.endTime).to.equal(endTime + periodSeconds)
      expect(nextPeriod.dripAmount).to.equal(dripAmount)
    })

    it('should drip if there are deposits', async () => {
      // ensure there is a deposit
      await drip.mint(wallet.address, toWei('11'))

      await expect(
        drip.drip(endTime, unlimitedTokens)
      )
        .to.emit(drip, 'MintedTotalSupply')
        .withArgs(dripAmount)

      const nextPeriod = await drip.getPeriod(2)
      expect(nextPeriod.endTime).to.equal(endTime + periodSeconds)
      expect(nextPeriod.dripAmount).to.equal(dripAmount)
    })

    it('should cap the drip amount by the max', async () => {
      // ensure there is a deposit
      await drip.mint(wallet.address, toWei('11'))

      const maxDripAmount = toWei('1')

      await expect(
        drip.drip(endTime, maxDripAmount)
      )
        .to.emit(drip, 'MintedTotalSupply')
        .withArgs(maxDripAmount)
    })

    it('should not drip if the period is not over', async () => {
      await expect(
        drip.drip(endTime / 2, unlimitedTokens)
      )
        .to.emit(drip, 'MintedTotalSupply')
        .withArgs('0')
    })
  })

  describe('mint()', () => {

    it('should not be affected by changes to the next drip', async () => {
      const newPeriodLength = 5
      const newDripAmount = toWei('100')
      await drip.setNextPeriod(newPeriodLength, newDripAmount)

      // ensure user has minted within the period
      await expect(drip.mint(wallet.address, toWei('10')))
        .to.emit(drip, 'Minted')
        .withArgs(0)

      // finish the period
      await expect(drip.drip(endTime, unlimitedTokens))
        .to.emit(drip, 'MintedTotalSupply')
        .withArgs(dripAmount)

      // now try to mint for the user
      await expect(drip.mint(wallet.address, toWei('10')))
        .to.emit(drip, 'Minted')
        .withArgs(dripAmount)
    })

    it('should increment a users balance and set their current period', async () => {
      await expect(drip.mint(wallet.address, toWei('10')))
        .to.emit(drip, 'Minted')
        .withArgs(0)

      let deposit = await drip.getDeposit(wallet.address)
      expect(deposit.balance).to.equal(toWei('10'))
      expect(deposit.period).to.equal(1)
    })

    it('should update their balance when depositing again', async () => {
      await expect(drip.mint(wallet.address, toWei('10')))
        .to.emit(drip, 'Minted')
        .withArgs(0)

      await expect(drip.mint(wallet.address, toWei('20')))
        .to.emit(drip, 'Minted')
        .withArgs(0)

      let deposit = await drip.getDeposit(wallet.address)
      expect(deposit.balance).to.equal(toWei('30'))
      expect(deposit.period).to.equal(1)
    })

    it('should accrue their previous amounts', async () => {
      // Period 1 now
      await expect(drip.mint(wallet.address, toWei('10')))
        .to.emit(drip, 'Minted')
        .withArgs(0)

      // Period 1 still
      await expect(drip.mint(wallet.address, toWei('20')))
        .to.emit(drip, 'Minted')
        .withArgs(0)

      await expect(drip.drip(endTime, unlimitedTokens))
        .to.emit(drip, 'MintedTotalSupply')
        .withArgs(dripAmount)

      // Period 2 now
      await expect(drip.mint(wallet.address, toWei('20')))
        .to.emit(drip, 'Minted')
        .withArgs(dripAmount)

      await expect(drip.mint(wallet.address, toWei('20')))
        .to.emit(drip, 'Minted')
        .withArgs(0)

      await expect(drip.drip(endTime + periodSeconds, unlimitedTokens))
        .to.emit(drip, 'MintedTotalSupply')
        .withArgs(dripAmount)

      // try minting zero for period 3
      await expect(drip.mint(wallet.address, toWei('0')))
        .to.emit(drip, 'Minted')
        .withArgs(dripAmount)
    })
  })
});
