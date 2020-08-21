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
  let endTime = 30

  beforeEach(async () => {
    [wallet, wallet2, wallet3, wallet4] = await buidler.ethers.getSigners()
    
    drip = await deployContract(wallet, VolumeDripExposed, [], overrides)

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
      await drip.setNextPeriod(5, toWei('5'))
      expect(await call(drip, 'poke', 30)).to.be.true
      await drip.poke(30)

      let period = await drip.getPeriod(2)
      expect(period.endTime).to.equal(35)
      expect(period.dripAmount).to.equal(toWei('5'))
    })
  })

  describe('poke()', () => {
    it('should complete the period when it is over', async () => {
      expect(await call(drip, 'poke', 30)).to.be.true
      await drip.poke(30)
      expect((await drip.getPeriod(2)).endTime).to.equal(40)
      await drip.poke(40)
      expect((await drip.getPeriod(3)).endTime).to.equal(50)
    })

    it('should not complete the period when the period is not over', async () => {
      expect(await call(drip, 'poke', 25)).to.be.false
      await drip.poke(25)
      expect((await drip.getPeriod(2)).endTime).to.equal(0)
    })
  })

  describe('mint()', () => {
    it('should increment a users balance and set their current period', async () => {
      await expect(drip.mint(wallet._address, toWei('10'), 20))
        .to.emit(drip, 'Minted')
        .withArgs(0, false)

      let deposit = await drip.getDeposit(wallet._address)
      expect(deposit.balance).to.equal(toWei('10'))
      expect(deposit.period).to.equal(1)
    })

    it('should update their balance when depositing again', async () => {
      await expect(drip.mint(wallet._address, toWei('10'), 20))
        .to.emit(drip, 'Minted')
        .withArgs(0, false)

      await expect(drip.mint(wallet._address, toWei('20'), 25))
        .to.emit(drip, 'Minted')
        .withArgs(0, false)

      let deposit = await drip.getDeposit(wallet._address)
      expect(deposit.balance).to.equal(toWei('30'))
      expect(deposit.period).to.equal(1)
    })

    it('should accrue their previous amounts', async () => {
      // Period 1 now
      await expect(drip.mint(wallet._address, toWei('10'), 20))
        .to.emit(drip, 'Minted')
        .withArgs(0, false)

      // Period 1 still
      await expect(drip.mint(wallet._address, toWei('20'), 25))
        .to.emit(drip, 'Minted')
        .withArgs(0, false)

      // Period 2 now
      await expect(drip.mint(wallet._address, toWei('20'), 35))
        .to.emit(drip, 'Minted')
        .withArgs(toWei('10'), true)

      await expect(drip.mint(wallet._address, toWei('20'), 37))
        .to.emit(drip, 'Minted')
        .withArgs(0, false)

      // try minting zero for period 3
      await expect(drip.mint(wallet._address, toWei('0'), 40))
        .to.emit(drip, 'Minted')
        .withArgs(toWei('10'), true)
    })
  })
});
