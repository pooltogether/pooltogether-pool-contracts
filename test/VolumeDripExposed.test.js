const { deployContract } = require('ethereum-waffle')
const VolumeDripExposed = require('../build/VolumeDripExposed.json')

const { call } = require('./helpers/call')
const { ethers } = require('ethers')
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:VolumeDripExposed.test')

let overrides = { gasLimit: 20000000 }

describe('VolumeDripExposed', function() {

  let drip

  let periodSeconds = 10
  let dripAmount = toWei('10')
  let startTime = 20

  beforeEach(async () => {
    [wallet, wallet2, wallet3, wallet4] = await buidler.ethers.getSigners()
    
    drip = await deployContract(wallet, VolumeDripExposed, [], overrides)

    debug({ drip: drip.address })

    await drip.initialize(periodSeconds, dripAmount, startTime)
  })

  describe('initialize()', () => {
    it('should set the params and start the first period', async () => {
      let info = await drip.getDrip();
      expect(info.periodSeconds).to.equal(periodSeconds)
      expect(info.dripAmount).to.equal(dripAmount)

      let period = await drip.getPeriod('0')
      expect(period.startTime).to.equal(startTime)
    })
  })

  describe('isPeriodOver()', () => {
    it('should return whether the period is over', async () => {
      expect(await drip.isPeriodOver(29)).to.be.false
      expect(await drip.isPeriodOver(30)).to.be.true
    })
  })

  describe('completePeriod()', () => {

    it('should start a new period immediately after the previous', async () => {
      await drip.completePeriod(30)
      let period = await drip.getPeriod('1')
      expect(period.startTime).to.equal(30)
    })

    it('should start a new period much later with the correct start time', async () => {
      await drip.completePeriod(55)
      let period = await drip.getPeriod('1')
      expect(period.startTime).to.equal(50)
    })

  })

  describe('calculateAccrued()', () => {
    it('should return 0 if the period has not ended', async () => {
      expect(await drip.calculateAccrued(0, toWei('10'))).to.equal('0')
    })

    it('should calculate the accrued amount if the period has ended', async () => {
      await drip.mint(wallet._address, toWei('55'), 20)
      await drip.completePeriod(30)
      expect(await drip.calculateAccrued(0, toWei('55'))).to.equal(toWei('10'))
    })
  })

  describe('mint()', () => {
    it('should increment a users balance and set their current period', async () => {
      await drip.mint(wallet._address, toWei('55'), 20)
      let deposit = await drip.getDeposit(wallet._address)

      expect(deposit.balance).to.equal(toWei('55'))
      expect(deposit.period).to.equal(0)

      let period = await drip.getPeriod('0')
      expect(period.totalSupply).to.equal(toWei('55'))
    })

    it('should increment a users balance and set their current period', async () => {
      await drip.completePeriod(30) // complete the first period
      await drip.mint(wallet._address, toWei('55'), 31)
      let deposit = await drip.getDeposit(wallet._address)
      expect(deposit.balance).to.equal(toWei('55'))
      expect(deposit.period).to.equal(1)
    })

    it('should revert if the period is over', async () => {
      await expect(drip.mint(wallet._address, toWei('55'), 30)).to.be.revertedWith('VolumeDrip/period-over')
    })

    it('should accrue their previous amounts', async () => {
      await drip.completePeriod(30)
      // period 0 closes with 0, and period 1 is opened with 55
      await drip.mint(wallet._address, toWei('55'), 31)
      // period 1 closes with 55, and period 2 opened with 17
      await drip.completePeriod(40)
      await drip.mint(wallet._address, toWei('17'), 41)

      let deposit = await drip.getDeposit(wallet._address)
      // belongs in period 2
      expect(deposit.balance).to.equal(toWei('17'))
      expect(deposit.period).to.equal(2)
      // accrued from period 1
      expect(deposit.accrued).to.equal(toWei('10'))
      
      let period = await drip.getPeriod('2')
      expect(period.totalSupply).to.equal(toWei('17'))

      // now mint for period 3
      await drip.completePeriod(50)
      await drip.mint(wallet._address, toWei('3'), 51)

      deposit = await drip.getDeposit(wallet._address)
      // belongs in period 2
      expect(deposit.balance).to.equal(toWei('3'))
      expect(deposit.period).to.equal(3)
      // accrued from period 1
      expect(deposit.accrued).to.equal(toWei('20'))
    })
  })

  describe('burnDrip()', () => {
    it('should do nothing if a user burns nothing', async () => {
      await drip.burnDrip(wallet._address)
    })

    it('should consume a users available accrued balance', async () => {
      // user now has period 1
      await drip.mint(wallet._address, toWei('55'), 29)
      await drip.completePeriod(30)
      await expect(drip.burnDrip(wallet._address))
        .to.emit(drip, 'DripTokensBurned')
        .withArgs(wallet._address, dripAmount)
      let deposit = await drip.getDeposit(wallet._address)
      expect(deposit.accrued).to.equal(0)
      expect(deposit.balance).to.equal(0)
    })

    it('should ignore balances that havent accrued', async () => {
      // user now has period 1
      await drip.mint(wallet._address, toWei('55'), 29)
      
      await drip.completePeriod(30)

      // user now has period 2
      await drip.mint(wallet._address, toWei('17'), 31)

      await expect(drip.burnDrip(wallet._address))
        .to.emit(drip, 'DripTokensBurned')
        .withArgs(wallet._address, dripAmount)

      let deposit = await drip.getDeposit(wallet._address)
      expect(deposit.accrued).to.equal(0)
      expect(deposit.balance).to.equal(toWei('17'))
    })    
  })

  describe('balanceOf()', () => {

    it('should be zero if there is no deposit', async () => {
      expect(await drip.balanceOf(wallet._address)).to.equal(toWei('0'))
    })

    it('should compute and return the correct balance', async () => {
      // user now has period 1
      await drip.mint(wallet._address, toWei('55'), 29)
      await drip.completePeriod(30)
      expect(await drip.balanceOf(wallet._address)).to.equal(toWei('10'))
    })

  })

});
