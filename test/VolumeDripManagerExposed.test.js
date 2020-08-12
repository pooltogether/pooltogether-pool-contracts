const { deployContract } = require('ethereum-waffle')
const VolumeDripManagerExposed = require('../build/VolumeDripManagerExposed.json')

const { ethers } = require('ethers')
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:VolumeDripManagerExposed.test')

let overrides = { gasLimit: 20000000 }

let MEASURE1 = '0x5A0b54D5dc17e0AadC383d2db43B0a0D3E029c4c'
let DRIP_TOKEN1 = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
let DRIP_TOKEN2 = '0x3EcEf08D0e2DaD803847E052249bb4F8bFf2D5bB'

let INVALID_MEASURE = '0x0000000000000000000000000000000000000002'

describe('VolumeDripManagerExposed', function() {

  let manager

  beforeEach(async () => {
    [wallet, wallet2, wallet3, wallet4] = await buidler.ethers.getSigners()

    manager = await deployContract(wallet, VolumeDripManagerExposed, [], overrides)

    debug({ manager: manager.address })
  })

  describe('addDrip()', () => {
    it('should add a new volume drip to the manager', async () => {
      await manager.addDrip(
        MEASURE1,
        DRIP_TOKEN1,
        10,
        toWei('0.001'),
        10
      )

      let drip1 = await manager.getDrip('1')
      expect(drip1.periodSeconds).to.equal(10)
      expect(drip1.dripAmount).to.equal(toWei('0.001'))
    })

    it('should allow two drips to be added', async () => {
      await manager.addDrip(
        MEASURE1,
        DRIP_TOKEN1,
        10,
        toWei('0.001'),
        10
      )
      await manager.addDrip(
        MEASURE1,
        DRIP_TOKEN2,
        20,
        toWei('0.1'),
        10
      )

      let drip1 = await manager.getDrip('1')
      expect(drip1.dripAmount).to.equal(toWei('0.001'))
      let drip2 = await manager.getDrip('2')
      expect(drip2.dripAmount).to.equal(toWei('0.1'))
    })
  })

  describe('removeDrip()', () => {
    it('should revert for non-existant measure drips', async () => {
      await expect(manager.removeDrip(INVALID_MEASURE, 1))
        .to.be.revertedWith('VolumeDripManager/unknown-measure-drip')
    })

    it('should remove a drip', async () => {
      await manager.addDrip(
        MEASURE1,
        DRIP_TOKEN1,
        10,
        toWei('0.001'),
        10
      )

      await manager.removeDrip(MEASURE1, '1')

      let drip1 = await manager.getDrip('1')
      expect(drip1.dripAmount).to.equal(toWei('0'))
    })
  })

  describe('setDripAmount()', () => {
    it('should revert for non-existant drips', async () => {
      await expect(manager.setDripAmount('5', toWei('0.99')))
        .to.be.revertedWith('VolumeDripManager/drip-not-exists')
    })

    it('should allow one to set the drip rate', async () => {
      await manager.addDrip(
        MEASURE1,
        DRIP_TOKEN1,
        10,
        toWei('0.001'),
        10
      )

      await manager.setDripAmount('1', toWei('0.99'))

      let drip = await manager.getDrip('1')

      expect(drip.dripAmount).to.equal(toWei('0.99'))
    })

  })

  describe('deposit()', () => {
    it('should allow a user to deposit into a drip', async () => {

      await manager.addDrip(
        MEASURE1,
        DRIP_TOKEN1,
        10,
        toWei('0.001'),
        10
      )

      await manager.deposit(MEASURE1, wallet._address, toWei('10'), 15)

      let deposit = await manager.getDeposit('1', wallet._address)
      expect(deposit.balance).to.equal(toWei('10'))

      let period = await manager.getPeriod('1', 0)

      expect(period.totalSupply).to.equal(toWei('10'))

    })

    it('should deposit across all drips', async () => {
      await manager.addDrip(
        MEASURE1,
        DRIP_TOKEN1,
        10,
        toWei('0.001'),
        10
      )
      await manager.addDrip(
        MEASURE1,
        DRIP_TOKEN2,
        20,
        toWei('0.1'),
        10
      )

      await manager.deposit(MEASURE1, wallet._address, toWei('10'), 15)

      let deposit = await manager.getDeposit('1', wallet._address)
      expect(deposit.balance).to.equal(toWei('10'))

      deposit = await manager.getDeposit('2', wallet._address)
      expect(deposit.balance).to.equal(toWei('10'))
    })
  })

  describe('deactivateDrip()', () => {
    it('should revert for non-existant measure drips', async () => {
      await expect(manager.deactivateDrip(INVALID_MEASURE, 1))
        .to.be.revertedWith('VolumeDripManager/unknown-measure-drip')
    })

    it('should allow drips to be deactivated but still claimed', async () => {
      await manager.addDrip(
        MEASURE1,
        DRIP_TOKEN1,
        10,
        toWei('1'),
        10
      )

      await manager.deposit(MEASURE1, wallet._address, toWei('10'), 15)

      // claim the accrued tokens
      await expect(manager.claimDripTokens('1', wallet._address, 20))
        .to.emit(manager, 'DripTokensClaimed')
        .withArgs('1', wallet._address, DRIP_TOKEN1, toWei('1'))

      // deactivate the drip
      await manager.deactivateDrip(MEASURE1, '1');

      // now run another deposit
      await manager.deposit(MEASURE1, wallet._address, toWei('10'), 25)

      // attempt to claim the accrued tokens - should be zero
      await expect(manager.claimDripTokens('1', wallet._address, 30))
        .to.emit(manager, 'DripTokensClaimed')
        .withArgs('1', wallet._address, DRIP_TOKEN1, toWei('0'))
    })
  })

  describe('activateDrip', () => {
    it('should revert for already activated drips', async () => {
      await manager.addDrip(
        MEASURE1,
        DRIP_TOKEN1,
        10,
        toWei('1'),
        10
      )
      await expect(manager.activateDrip(MEASURE1, '1'))
        .to.be.revertedWith('VolumeDripManager/drip-active')
    })

    it('should be possible to reactivate a volume drip', async () => {
      await manager.addDrip(
        MEASURE1,
        DRIP_TOKEN1,
        10,
        toWei('1'),
        10
      )

      await manager.deposit(MEASURE1, wallet._address, toWei('10'), 15)

      // claim the accrued tokens
      await expect(manager.claimDripTokens('1', wallet._address, 20))
        .to.emit(manager, 'DripTokensClaimed')
        .withArgs('1', wallet._address, DRIP_TOKEN1, toWei('1'))

      // deactivate the drip
      await manager.deactivateDrip(MEASURE1, '1');

      // now run another deposit
      await manager.deposit(MEASURE1, wallet._address, toWei('10'), 25)

      // reactivate the drip
      await manager.activateDrip(MEASURE1, '1');

      // now run another deposit for a different user
      await manager.deposit(MEASURE1, wallet2._address, toWei('10'), 26)

      // attempt to claim the accrued tokens - should be zero
      await expect(manager.claimDripTokens('1', wallet2._address, 30))
        .to.emit(manager, 'DripTokensClaimed')
        .withArgs('1', wallet2._address, DRIP_TOKEN1, toWei('1'))
    })
  })

  describe('claimDripTokens()', () => {

    it('should allow a users tokens to be claimed', async () => {
      // create drip with a rate of 0.1 over 10 blocks => total of 1 token
      await manager.addDrip(
        MEASURE1,
        DRIP_TOKEN1,
        10,
        toWei('1'),
        10
      )

      await manager.deposit(MEASURE1, wallet._address, toWei('10'), 15)
      await manager.deposit(MEASURE1, wallet2._address, toWei('30'), 15)

      await expect(manager.claimDripTokens('1', wallet._address, 20))
        .to.emit(manager, 'DripTokensClaimed')
        .withArgs('1', wallet._address, DRIP_TOKEN1, toWei('0.25'))

      await expect(manager.claimDripTokens('1', wallet2._address, 20))
        .to.emit(manager, 'DripTokensClaimed')
        .withArgs('1', wallet2._address, DRIP_TOKEN1, toWei('0.75'))
    })

  })

});
