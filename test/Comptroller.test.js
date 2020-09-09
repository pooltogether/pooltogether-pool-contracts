const { expect } = require("chai");
const ComptrollerHarness = require('../build/ComptrollerHarness.json')
const IERC20 = require('../build/IERC20.json')
const buidler = require('@nomiclabs/buidler')
const { deployContract } = require('ethereum-waffle')
const { deployMockContract } = require('./helpers/deployMockContract')
const { AddressZero } = require("ethers").constants
const { call } = require('./helpers/call')

const toWei = ethers.utils.parseEther

const overrides = { gasLimit: 20000000 }

const debug = require('debug')('ptv3:Comptroller.test')

const SENTINEL = '0x0000000000000000000000000000000000000001'

async function getLastEvent(contract, tx) {
  let receipt = await buidler.ethers.provider.getTransactionReceipt(tx.hash)
  let lastLog = receipt.logs[receipt.logs.length - 1]
  return contract.interface.parseLog(lastLog)
}

describe('Comptroller', () => {

  let wallet, wallet2

  let provider
  let comptroller, comptroller2, dripToken, measure

  let prizeStrategyAddress

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()
    provider = buidler.ethers.provider

    // just fake it so that we can call it as if we *were* the prize strategy
    prizeStrategyAddress = wallet._address

    measure = await deployMockContract(wallet, IERC20.abi)
    dripToken = await deployMockContract(wallet, IERC20.abi)
    comptroller = await deployContract(wallet, ComptrollerHarness, [], overrides)
    comptroller2 = comptroller.connect(wallet2)
    await comptroller.initialize(wallet._address)

    await measure.mock.totalSupply.returns('0')
  })

  describe('initialize()', () => {
    it("should set the owner wallet", async () => {
      expect(await comptroller.owner()).to.equal(wallet._address)
    })
  })

  describe('setReserveRateMantissa()', () => {
    it('should allow the owner to set the reserve', async () => {
      await expect(comptroller.setReserveRateMantissa(toWei('0.1')))
        .to.emit(comptroller, 'ReserveRateMantissaSet')
        .withArgs(toWei('0.1'))

      expect(await comptroller.reserveRateMantissa()).to.equal(toWei('0.1'))
    })

    it('should not allow anyone else to configure the reserve rate', async () => {
      await expect(comptroller2.setReserveRateMantissa(toWei('0.2'))).to.be.revertedWith("Ownable: caller is not the owner")
    })
  })

  describe('activateBalanceDrip()', () => {
    it('should add a balance drip', async () => {
      await expect(comptroller.activateBalanceDrip(prizeStrategyAddress, measure.address, dripToken.address, toWei('0.001')))
        .to.emit(comptroller, 'BalanceDripActivated')
        .withArgs(wallet._address, measure.address, dripToken.address, toWei('0.001'))

      let drip = await comptroller.getBalanceDrip(prizeStrategyAddress, measure.address, dripToken.address)
      expect(drip.dripRatePerSecond).to.equal(toWei('0.001'))
    })

    it('should allow only the owner to add drips', async () => {
      await expect(comptroller2.activateBalanceDrip(prizeStrategyAddress, measure.address, dripToken.address, toWei('0.001'))).to.be.revertedWith("Ownable: caller is not the owner")
    })
  })

  describe('deactivateBalanceDrip()', () => {
    beforeEach(async () => {
      await comptroller.activateBalanceDrip(prizeStrategyAddress, measure.address, dripToken.address, toWei('0.001'))
    })

    it('should remove a balance drip', async () => {
      await expect(comptroller.deactivateBalanceDrip(prizeStrategyAddress, measure.address, dripToken.address, SENTINEL))
        .to.emit(comptroller, 'BalanceDripDeactivated')
        .withArgs(wallet._address, measure.address, dripToken.address)

      let drip = await comptroller.getBalanceDrip(prizeStrategyAddress, measure.address, dripToken.address)
      expect(drip.dripRatePerSecond).to.equal('0')
    })

    it('should allow only the owner to remove drips', async () => {
      await expect(comptroller2.deactivateBalanceDrip(prizeStrategyAddress, measure.address, dripToken.address, SENTINEL)).to.be.revertedWith("Ownable: caller is not the owner")
    })
  })

  describe('setBalanceDripRate()', () => {
    beforeEach(async () => {
      await comptroller.activateBalanceDrip(prizeStrategyAddress, measure.address, dripToken.address, toWei('0.001'))
    })

    it('should allow the owner to update the drip rate', async () => {
      await expect(comptroller.setBalanceDripRate(wallet._address, measure.address, dripToken.address, toWei('0.1')))
        .to.emit(comptroller, 'BalanceDripRateSet')
        .withArgs(wallet._address, measure.address, dripToken.address, toWei('0.1'))

      let drip = await comptroller.getBalanceDrip(prizeStrategyAddress, measure.address, dripToken.address)
      expect(drip.dripRatePerSecond).to.equal(toWei('0.1'))
    })

    it('should not allow anyone else to update the drip rate', async () => {
      await expect(comptroller2.setBalanceDripRate(wallet._address, measure.address, dripToken.address, toWei('0.1'))).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('activateVolumeDrip()', () => {
    it('should allow the owner to add a volume drip', async () => {
      let tx = comptroller.activateVolumeDrip(prizeStrategyAddress, measure.address, dripToken.address, false, 10, toWei('100'), 10)

      await expect(tx)
        .to.emit(comptroller, 'VolumeDripActivated')
        .withArgs(
          prizeStrategyAddress,
          measure.address,
          dripToken.address,
          false,
          10,
          toWei('100')
        )

      await expect(tx)
        .to.emit(comptroller, 'VolumeDripPeriodStarted')
        .withArgs(
          prizeStrategyAddress,
          measure.address,
          dripToken.address,
          false,
          1,
          toWei('100'),
          10
        )

      let drip = await comptroller.getVolumeDrip(
        prizeStrategyAddress,
        measure.address,
        dripToken.address,
        false
      )

      expect(drip.periodSeconds).to.equal(10)
      expect(drip.dripAmount).to.equal(toWei('100'))

      let period = await comptroller.getVolumeDripPeriod(
        prizeStrategyAddress,
        measure.address,
        dripToken.address,
        false,
        1
      )

      expect(
        await comptroller.isVolumeDripActive(
          prizeStrategyAddress,
          measure.address,
          dripToken.address,
          false
        )
      ).to.be.true

      expect(period.totalSupply).to.equal(0)
      expect(period.dripAmount).to.equal(toWei('100'))
      expect(period.endTime).to.equal(10)
    })

    it('should not allow anyone else', async () => {
      await expect(
        comptroller2.activateVolumeDrip(
          prizeStrategyAddress, 
          measure.address,
          dripToken.address,
          false,
          10,
          toWei('100'),
          10
        )
      ).to.be.revertedWith("Ownable: caller is not the owner")
    })
  })

  describe('deactivateVolumeDrip()', () => {
    it('should allow the owner to remove a volume drip', async () => {
      await comptroller.activateVolumeDrip(prizeStrategyAddress, measure.address, dripToken.address, false, 10, toWei('100'), 10)

      await expect(
        comptroller.deactivateVolumeDrip(
          prizeStrategyAddress,
          measure.address,
          dripToken.address,
          false,
          SENTINEL
        )
      )
        .to.emit(comptroller, 'VolumeDripDeactivated')
        .withArgs(
          prizeStrategyAddress,
          measure.address,
          dripToken.address,
          false
        )

      expect(
        await comptroller.isVolumeDripActive(
          prizeStrategyAddress,
          measure.address,
          dripToken.address,
          false
        )
      ).to.be.false
      
    })

    it('should not allow anyone else to remove', async () => {
      await comptroller.activateVolumeDrip(
        prizeStrategyAddress,
        measure.address,
        dripToken.address,
        false,
        10,
        toWei('100'),
        10
      )

      await expect(
        comptroller2.deactivateVolumeDrip(
          prizeStrategyAddress,
          measure.address,
          dripToken.address,
          false,
          SENTINEL
        )
      ).to.be.revertedWith("Ownable: caller is not the owner")
    })
  })

  describe('setVolumeDrip()', () => {
    it('should allow the owner to set the drip amount for a volume drip', async () => {
      await comptroller.activateVolumeDrip(
        prizeStrategyAddress,
        measure.address,
        dripToken.address,
        false,
        10,
        toWei('100'),
        10
      )

      await expect(
        comptroller.setVolumeDrip(
          prizeStrategyAddress,
          measure.address,
          dripToken.address,
          false,
          20,
          toWei('200')
        )
      )
        .to.emit(comptroller, 'VolumeDripSet')
        .withArgs(
          prizeStrategyAddress,
          measure.address,
          dripToken.address,
          false,
          20,
          toWei('200')
        )

      let drip = await comptroller.getVolumeDrip(
        prizeStrategyAddress,
        measure.address,
        dripToken.address,
        false
      )

      expect(drip.dripAmount).to.equal(toWei('200'))
      expect(drip.periodSeconds).to.equal(20)
    })

    it('should not allow anyone else to set the drip amount', async () => {
      await comptroller.activateVolumeDrip(
        prizeStrategyAddress,
        measure.address,
        dripToken.address,
        false,
        10,
        toWei('100'),
        10
      )
      
      await expect(
        comptroller2.setVolumeDrip(
          prizeStrategyAddress,
          measure.address,
          dripToken.address,
          false,
          20,
          toWei('200')
        )
      ).to.be.revertedWith("Ownable: caller is not the owner")
    })
  })

  describe('afterDepositTo()', () => {
    it('should update the balance drips', async () => {
      await comptroller.setCurrentTime(1)
      await comptroller.activateBalanceDrip(prizeStrategyAddress, measure.address, dripToken.address, toWei('0.001'))
      await comptroller.afterDepositTo(wallet._address, toWei('10'), toWei('10'), toWei('10'), measure.address, AddressZero)
      await comptroller.setCurrentTime(11)
      // should have accrued 10 blocks worth of the drip: 10 * 0.001 = 0.01

      await dripToken.mock.transfer.withArgs(wallet._address, toWei('0.01')).returns(true)
      await measure.mock.balanceOf.withArgs(wallet._address).returns(toWei('10'))
      await measure.mock.totalSupply.returns(toWei('10'))

      // first do a pre-flight to get balances
      let balances = await call(comptroller, 'updateDrips', 
        [{ source: prizeStrategyAddress, measure: measure.address }],
        wallet._address, 
        [dripToken.address]
      )

      expect(balances).to.deep.equal([[
        dripToken.address,
        toWei('0.01')
      ]])

      // now run it
      await comptroller.updateDrips(
        [{ source: prizeStrategyAddress, measure: measure.address }],
        wallet._address, 
        []
      )

      await expect(comptroller.claimDrip(wallet._address, dripToken.address, toWei('0.01')))
        .to.emit(comptroller, 'DripTokenClaimed')
        .withArgs(wallet._address, wallet._address, dripToken.address, toWei('0.01'))
    })
  })

  describe('afterWithdrawFrom()', () => {
    it('should update the balance drips', async () => {
      await comptroller.setCurrentTime(1)
      await comptroller.activateBalanceDrip(prizeStrategyAddress, measure.address, dripToken.address, toWei('0.001'))
      await comptroller.afterDepositTo(wallet._address, toWei('10'), toWei('10'), toWei('10'), measure.address, AddressZero)
      await comptroller.setCurrentTime(11)
      await comptroller.afterWithdrawFrom(wallet._address, toWei('10'), toWei('0'), toWei('0'), measure.address)

      // user should have accrued 0.01 tokens, now they should be accruing none.

      // move forward another 10 seconds
      await comptroller.setCurrentTime(21)

      // now we claim, and it should not add any more tokens
      await dripToken.mock.transfer.withArgs(wallet._address, toWei('0.01')).returns(true)
      await measure.mock.balanceOf.withArgs(wallet._address).returns(toWei('0'))
      await measure.mock.totalSupply.returns(toWei('0'))
      await expect(comptroller.claimDrip(wallet._address, dripToken.address, toWei('0.01')))
        .to.emit(comptroller, 'DripTokenClaimed')
        .withArgs(wallet._address, wallet._address, dripToken.address, toWei('0.01'))
    })
  })
})
