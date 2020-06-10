const { deployContract, deployMockContract } = require('ethereum-waffle')
const Credit = require('../build/Credit.json')
const InterestTracker = require('../build/InterestTracker.json')
const {
  INTEREST_TRACKER_INTERFACE_HASH
} = require('../js/constants')

const PrizePoolModuleManager = require('../build/PrizePoolModuleManager.json')
const { ethers } = require('./helpers/ethers')
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

  let credit, interestTracker, manager

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()

    manager = await deployMockContract(wallet, PrizePoolModuleManager.abi, overrides)
    credit = await deployMockContract(wallet, Credit.abi, overrides)

    await manager.mock.enableModuleInterface.withArgs(INTEREST_TRACKER_INTERFACE_HASH).returns()
    await manager.mock.credit.returns(credit.address)
    await manager.mock.isModuleEnabled.withArgs(wallet._address).returns(true)

    interestTracker = await deployContract(wallet, InterestTracker, [], overrides)
    await interestTracker.initialize(manager.address, FORWARDER, overrides)
  })

  describe('supplyCollateral()', () => {
    it('should increase the users balance', async () => {
      await interestTracker.supplyCollateral(wallet._address, toWei('10'), overrides)

      expect(await interestTracker.balanceOf(wallet._address)).to.equal(toWei('10'))
      expect(await interestTracker.interestRatioMantissa(wallet._address)).to.equal(toWei('0'))
    })

    async function showCredit() {
      debug({ wallet: fromWei(await interestTracker.balanceOf(wallet._address)).toString() })
      debug({ forwarder: fromWei(await interestTracker.balanceOf(FORWARDER)).toString() })
    }

    it('should accurately record the users interest', async () => {

      // two users join the pool with the same amount
      await expect(interestTracker.supplyCollateral(wallet._address, toWei('100'), overrides))
        .to.emit(interestTracker, 'CollateralSupplied')
        .withArgs(wallet._address, wallet._address, toWei('100'), toWei('100'))

      await interestTracker.supplyCollateral(FORWARDER, toWei('100'), overrides)

      let prize1 = '39.01851372'
      // prize accrues
      await expect(interestTracker.accrueInterest(toWei(prize1), overrides))
        .to.emit(interestTracker, 'InterestAccrued')
        .withArgs(wallet._address, toWei(prize1))

      // prize is awarded to the winner
      await interestTracker.supplyCollateral(FORWARDER, toWei(prize1), overrides)

      // await showCredit()

      // prize accrues
      let prize2 = '52.34372078'
      await interestTracker.accrueInterest(toWei(prize2), overrides)
      // prize is awarded to the winner
      await interestTracker.supplyCollateral(wallet._address, toWei(prize2), overrides)

      // await showCredit()

      let prize3 = '63.80670355'
      // prize accrues
      await interestTracker.accrueInterest(toWei(prize3), overrides)
      // prize is awarded to the winner
      await interestTracker.supplyCollateral(FORWARDER, toWei(prize3), overrides)

      await showCredit()

      expect(await interestTracker.balanceOf(wallet._address)).to.equal(toWei('226.753787811082561455'))
      expect(await interestTracker.balanceOf(FORWARDER)).to.equal(toWei('283.584088288917438496'))
    })
  })

  describe('redeemCollateral()', () => {
    it('should accurately remove the users collateral', async () => {
      await interestTracker.supplyCollateral(wallet._address, toWei('100'))

      await expect(interestTracker.redeemCollateral(wallet._address, toWei('50')))
        .to.emit(interestTracker, 'CollateralRedeemed')
        .withArgs(wallet._address, wallet._address, toWei('50'), toWei('50'), '0')

      expect(await interestTracker.balanceOf(wallet._address)).to.equal(toWei('50'))
    })

    it('should revert when attempting to redeem more than available collateral', async () => {
      await interestTracker.supplyCollateral(wallet._address, toWei('100'))

      await expect(interestTracker.redeemCollateral(wallet._address, toWei('101'))).to.be.revertedWith('InterestTracker/insuff')
    })

    it('should convert excess interest into credit on partial redeems', async () => {
      await interestTracker.supplyCollateral(wallet._address, toWei('100'))
      await interestTracker.accrueInterest(toWei('10'))

      await credit.mock.mint.withArgs(wallet._address, toWei('5')).returns()

      await interestTracker.redeemCollateral(wallet._address, toWei('50'))
      debug("Redeemed...")
      expect(await interestTracker.balanceOfInterest(wallet._address)).to.equal(toWei('5'))
      debug("calculated...")
    })

    it('should convert all interest to credit on full redeems', async () => {
      await interestTracker.supplyCollateral(wallet._address, toWei('100'))
      await interestTracker.accrueInterest(toWei('10'))
      await credit.mock.mint.withArgs(wallet._address, toWei('10')).returns()
      await interestTracker.redeemCollateral(wallet._address, toWei('100'))
      expect(await interestTracker.balanceOf(wallet._address)).to.equal(toWei('0'))
      expect(await interestTracker.balanceOfInterest(wallet._address)).to.equal(toWei('0'))
    })
  })

  describe('transferCollateral()', () => {
    it('should allow users to transfer collateral', async () => {
      await interestTracker.supplyCollateral(wallet._address, toWei('100'))
      await interestTracker.transferCollateral(wallet._address, FORWARDER, toWei('100'))

      expect(await interestTracker.balanceOf(wallet._address)).to.equal(toWei('0'))
      expect(await interestTracker.balanceOf(FORWARDER)).to.equal(toWei('100'))
    })

    it('should convert interest into credit', async () => {
      await interestTracker.supplyCollateral(wallet._address, toWei('100'))
      await interestTracker.accrueInterest(toWei('10'))
      await credit.mock.mint.withArgs(wallet._address, toWei('10')).returns()
      await interestTracker.transferCollateral(wallet._address, FORWARDER, toWei('100'))

      expect(await interestTracker.balanceOf(wallet._address)).to.equal(toWei('0'))
      expect(await interestTracker.balanceOf(FORWARDER)).to.equal(toWei('100'))
    })
  })

  describe('accrueInterest()', () => {
    it('should evenly disperse credit', async () => {
      await interestTracker.supplyCollateral(wallet._address, toWei('20'))
      await interestTracker.supplyCollateral(FORWARDER, toWei('10'))

      await interestTracker.accrueInterest(toWei('30'))

      expect(await interestTracker.balanceOf(wallet._address)).to.equal(toWei('40'))
      expect(await interestTracker.balanceOf(FORWARDER)).to.equal(toWei('20'))
    })
  })

  describe('interestRatioMantissa', () => {
    it('should calculate the creditization for a user', async () => {
      await interestTracker.supplyCollateral(wallet._address, toWei('40'))
      await interestTracker.supplyCollateral(FORWARDER, toWei('10'))
      await interestTracker.accrueInterest(toWei('25'))

      expect(await interestTracker.interestRatioMantissa(wallet._address)).to.equal(toWei('0.5'))
      expect(await interestTracker.interestRatioMantissa(FORWARDER)).to.equal(toWei('0.5'))
    })
  })
});
