const { deployContract, deployMockContract } = require('ethereum-waffle')
const YieldServiceInterface = require('../build/YieldServiceInterface.json')
const InterestTracker = require('../build/InterestTracker.json')
const {
  INTEREST_TRACKER_INTERFACE_HASH
} = require('../js/constants')

const PrizePoolModuleManager = require('../build/PrizePoolModuleManager.json')
const { ethers } = require('./helpers/ethers')
const { call } = require('./helpers/call')
const { expect } = require('chai')
const buidler = require('./helpers/buidler')

const toWei = ethers.utils.parseEther
const fromWei = ethers.utils.formatEther

const debug = require('debug')('ptv3:Credit.test')

const FORWARDER = '0x5f48a3371df0F8077EC741Cc2eB31c84a4Ce332a'

let overrides = { gasLimit: 20000000 }

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe('InterestTracker', function() {

  let wallet

  let yieldService, interestTracker, interestTracker2, manager

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()

    manager = await deployMockContract(wallet, PrizePoolModuleManager.abi, overrides)
    yieldService = await deployMockContract(wallet, YieldServiceInterface.abi, overrides)

    await manager.mock.enableModuleInterface.withArgs(INTEREST_TRACKER_INTERFACE_HASH).returns()
    await manager.mock.isModuleEnabled.withArgs(wallet._address).returns(true)
    await manager.mock.isModuleEnabled.withArgs(wallet2._address).returns(true)
    await manager.mock.yieldService.returns(yieldService.address)

    interestTracker = await deployContract(wallet, InterestTracker, [], overrides)
    await interestTracker.initialize(manager.address, FORWARDER, overrides)
    interestTracker2 = await interestTracker.connect(wallet2)
  })

  describe('supplyCollateral()', () => {
    it('should increase the users balance', async () => {
      await yieldService.mock.unaccountedBalance.returns('0')
      await expect(interestTracker.supplyCollateral(toWei('10'), overrides))
        .to.emit(interestTracker, 'CollateralSupplied')
        .withArgs(wallet._address, toWei('10'), toWei('10'))

      expect(await interestTracker.balanceOf(wallet._address)).to.equal(toWei('10'))
      expect(await interestTracker.totalSupply()).to.equal(toWei('10'))
      expect(await call(interestTracker, 'balanceOfCollateral', wallet._address)).to.equal(toWei('10'))
    })

    async function showCredit() {
      debug({ wallet: fromWei(await call(interestTracker, 'balanceOfCollateral', wallet._address)).toString() })
      debug({ wallet2: fromWei(await call(interestTracker, 'balanceOfCollateral', wallet2._address)).toString() })
    }

    it('should capture unaccounted interest', async () => {
      await yieldService.mock.unaccountedBalance.returns('0')

      await interestTracker.supplyCollateral(toWei('100'))

      await yieldService.mock.unaccountedBalance.returns(toWei('50'))
      await yieldService.mock.capture.withArgs(toWei('50')).returns()

      expect(await call(interestTracker, 'balanceOfCollateral', wallet._address)).to.equal(toWei('150'))
    })

    it('should not capture previously unaccounted interest', async () => {
      await yieldService.mock.unaccountedBalance.returns('0')
      await interestTracker.supplyCollateral(toWei('100'))

      await yieldService.mock.unaccountedBalance.returns(toWei('100'))
      await yieldService.mock.capture.withArgs(toWei('100')).returns()

      await interestTracker2.supplyCollateral(toWei('100'))

      // reset unaccountedBalance
      await yieldService.mock.unaccountedBalance.returns('0')

      expect(await interestTracker.totalCollateral()).to.equal(toWei('300'))
      expect(await interestTracker.balanceOf(wallet._address)).to.equal(toWei('100'))
      expect(await interestTracker.balanceOf(wallet2._address)).to.equal(toWei('50'))
      expect(await interestTracker.totalSupply()).to.equal(toWei('150'))
      expect(await call(interestTracker, 'balanceOfCollateral', wallet._address)).to.equal(toWei('200'))
      expect(await call(interestTracker, 'balanceOfCollateral', wallet2._address)).to.equal(toWei('100'))
    })

    it('should accurately record the users interest', async () => {
      await yieldService.mock.unaccountedBalance.returns('0')

      // two users join the pool with the same amount
      await expect(interestTracker.supplyCollateral(toWei('100'), overrides))
        .to.emit(interestTracker, 'CollateralSupplied')
        .withArgs(wallet._address, toWei('100'), toWei('100'))
      

      await interestTracker2.supplyCollateral(toWei('100'), overrides)

      // await showCredit()

      let prize1 = '39.01851372'
      await yieldService.mock.unaccountedBalance.returns(toWei(prize1))
      await yieldService.mock.capture.withArgs(toWei(prize1)).returns()

      // prize is awarded to first wallet
      await expect(interestTracker.captureInterest(overrides))
        .to.emit(interestTracker, 'InterestCaptured')
        .withArgs(wallet._address, toWei(prize1))

      // reset available interest
      await yieldService.mock.unaccountedBalance.returns(toWei('0'))

      // // // prize is awarded to the winner
      await interestTracker2.supplyCollateral(toWei(prize1), overrides)

      expect(await call(interestTracker, 'balanceOfCollateral', wallet._address)).to.equal(toWei('119.50925686'))
      expect(await call(interestTracker, 'balanceOfCollateral', wallet2._address)).to.equal(toWei('158.527770579999999999'))
    })
  })

  describe('redeemCollateral()', () => {
    it('should accurately remove the users collateral', async () => {
      await yieldService.mock.unaccountedBalance.returns('0')

      await interestTracker.supplyCollateral(toWei('100'))

      await expect(interestTracker.redeemCollateral(toWei('50')))
        .to.emit(interestTracker, 'CollateralRedeemed')
        .withArgs(wallet._address, toWei('50'), toWei('50'))

      expect(await interestTracker.balanceOf(wallet._address)).to.equal(toWei('50'))
    })

    it('should revert when attempting to redeem more than available collateral', async () => {
      await yieldService.mock.unaccountedBalance.returns('0')

      await interestTracker.supplyCollateral(toWei('100'))

      await expect(interestTracker.redeemCollateral(toWei('101'))).to.be.revertedWith('InterestTracker/insuff')
    })

    it('should handle redeems when there is unaccounted balance', async () => {
      await yieldService.mock.unaccountedBalance.returns(toWei('0'))

      await interestTracker.supplyCollateral(toWei('100'))

      await yieldService.mock.unaccountedBalance.returns(toWei('100'))
      await yieldService.mock.capture.withArgs(toWei('100')).returns()

      // user claims new collateral
      expect(await call(interestTracker, 'balanceOfCollateral', wallet._address)).to.equal(toWei('200'))

      // redeems all of their collateral
      await interestTracker.redeemCollateral(toWei('200'))

      // reset
      await yieldService.mock.unaccountedBalance.returns(toWei('0'))

      expect(await call(interestTracker, 'balanceOfCollateral', wallet._address)).to.equal(toWei('0'))
    })
  })

  describe('captureInterest()', () => {
    it('should capture interest from the yield service', async () => {
      expect(await interestTracker.totalCollateral()).to.equal('0')
      await yieldService.mock.unaccountedBalance.returns(toWei('10'))
      await yieldService.mock.capture.withArgs(toWei('10')).returns()
      await interestTracker.captureInterest()
      expect(await interestTracker.totalCollateral()).to.equal(toWei('10'))
    })
  })
});
