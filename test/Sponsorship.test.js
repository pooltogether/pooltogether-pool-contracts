const { deployContract, deployMockContract } = require('ethereum-waffle')
const { deploy1820 } = require('deploy-eip-1820')
const Sponsorship = require('../build/SponsorshipHarness.json')
const PeriodicPrizePool = require('../build/PeriodicPrizePool.json')
const Credit = require('../build/Credit.json')
const Timelock = require('../build/Timelock.json')
const IERC20 = require('../build/IERC20.json')
const PrizePoolModuleManager = require('../build/PrizePoolModuleManager.json')
const InterestTracker = require('../build/InterestTracker.json')

const CompoundYieldService = require('../build/CompoundYieldService.json')
const {
  SPONSORSHIP_INTERFACE_HASH,
} = require('../js/constants')

const { call } = require('./helpers/call')
const { ethers } = require('./helpers/ethers')
const { expect } = require('chai')
const buidler = require('./helpers/buidler')
const { CALL_EXCEPTION } = require('ethers/errors')

const toWei = ethers.utils.parseEther
const toEther = ethers.utils.formatEther

const debug = require('debug')('ptv3:Sponsorship.test')

const FORWARDER = '0x5f48a3371df0F8077EC741Cc2eB31c84a4Ce332a'

let overrides = { gasLimit: 20000000 }

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe.only('Sponsorship contract', function() {

  let sponsorship

  let wallet, wallet2

  let prizePool, yieldService, manager, token, interestTracker, sponsorshipCredit

  let lastTxTimestamp

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()

    debug(`using wallet ${wallet._address}`)

    debug('creating manager and registry...')

    await deploy1820(wallet)

    manager = await deployMockContract(wallet, PrizePoolModuleManager.abi, overrides)
    token = await deployMockContract(wallet, IERC20.abi, overrides)
    yieldService = await deployMockContract(wallet, CompoundYieldService.abi, overrides)
    interestTracker = await deployMockContract(wallet, InterestTracker.abi, overrides)
    prizePool = await deployMockContract(wallet, PeriodicPrizePool.abi, overrides)
    timelock = await deployMockContract(wallet, Timelock.abi, overrides)
    sponsorshipCredit = await deployMockContract(wallet, Credit.abi, overrides)

    await yieldService.mock.token.returns(token.address)
    await manager.mock.enableModuleInterface.withArgs(SPONSORSHIP_INTERFACE_HASH).returns()
    await manager.mock.isModuleEnabled.withArgs(wallet._address).returns(true)

    await manager.mock.yieldService.returns(yieldService.address)
    await manager.mock.interestTracker.returns(interestTracker.address)
    await manager.mock.prizePool.returns(prizePool.address)
    await manager.mock.timelock.returns(timelock.address)
    await manager.mock.sponsorshipCredit.returns(sponsorshipCredit.address)

    sponsorship = await deployContract(wallet, Sponsorship, [], overrides)

    let tx = await sponsorship['initialize(address,address,string,string)'](
      manager.address,
      FORWARDER,
      'SPONSORSHIP',
      'SPON'
    )
    // let block = await buidler.ethers.provider.getBlock(tx.blockNumber)
    // lastTxTimestamp = block.timestamp
  })

  describe('initialize()', () => {
    it('should set the params', async () => {
      expect(await sponsorship.name()).to.equal('SPONSORSHIP')
      expect(await sponsorship.symbol()).to.equal('SPON')
      expect(await sponsorship.getTrustedForwarder()).to.equal(FORWARDER)
    })
  })

  describe('supply()', () => {
    it('should mint sponsorship tokens', async () => {
      let amount = toWei('10')

      await token.mock.transferFrom.withArgs(wallet._address, sponsorship.address, amount).returns(true)
      
      // ensure yield service approved
      await token.mock.allowance.returns(0)
      await token.mock.approve.returns(true)
      
      // supply to yield service
      await yieldService.mock.supply.withArgs(amount).returns()
      await prizePool.mock.mintedTickets.withArgs(toWei('10')).returns()
      await interestTracker.mock.supplyCollateral.withArgs(amount).returns(amount)

      await sponsorship.supply(wallet._address, toWei('10'), [])

      expect(await sponsorship.balanceOfInterestShares(wallet._address)).to.equal(amount)
      expect(await sponsorship.balanceOf(wallet._address)).to.equal(amount)
    })
  })

  describe('redeem()', () => {
    it('should allow a sponsor to redeem their sponsorship tokens', async () => {
      await sponsorship.setInterestSharesForTest(wallet._address, toWei('10'))
      await sponsorship.mintForTest(wallet._address, toWei('10'))

      // burn tickets
      await prizePool.mock.redeemedTickets.withArgs(toWei('10')).returns()

      // credit user
      await interestTracker.mock.totalSupply.returns(toWei('10'))
      await interestTracker.mock.redeemCollateral.withArgs(toWei('10')).returns(toWei('10'))
      await interestTracker.mock.exchangeRateMantissa.returns(toWei('1'));
      await sponsorshipCredit.mock.mint.withArgs(wallet._address, toWei('10')).returns()

      await yieldService.mock.redeem.withArgs(toWei('10')).returns()

      await token.mock.transfer.withArgs(wallet._address, toWei('10')).returns(true)

      await expect(sponsorship.redeem(toWei('10'), []))
        .to.emit(sponsorship, 'SponsorshipRedeemed')
        .withArgs(wallet._address, wallet._address, toWei('10'))
    })

    it('should not allow a sponsor to redeem more sponsorship tokens than they hold', async () => {
      await sponsorship.setInterestSharesForTest(wallet._address, toWei('10'))
      await sponsorship.mintForTest(wallet._address, toWei('10'))

      // burn tickets
      await prizePool.mock.redeemedTickets.withArgs(toWei('10')).returns()

      // credit user
      await interestTracker.mock.totalSupply.returns(toWei('10'))
      await interestTracker.mock.redeemCollateral.withArgs(toWei('10')).returns(toWei('10'))
      await interestTracker.mock.exchangeRateMantissa.returns(toWei('1'));
      await sponsorshipCredit.mock.mint.withArgs(wallet._address, toWei('10')).returns()

      await yieldService.mock.redeem.withArgs(toWei('10')).returns()

      await token.mock.transfer.withArgs(wallet._address, toWei('10')).returns(true)

      await expect(sponsorship.redeem(toWei('10'), []))
        .to.emit(sponsorship, 'SponsorshipRedeemed')
        .withArgs(wallet._address, wallet._address, toWei('10'))
    })
  })

  describe('operatorRedeem()', () => {
    it('should allow an operator to redeem on behalf of a sponsor their sponsorship tokens', async () => {
      await sponsorship.setInterestSharesForTest(wallet._address, toWei('10'))
      await sponsorship.mintForTest(wallet._address, toWei('10'))

      // approve operator
      await sponsorship.authorizeOperator(wallet2._address)

      // burn tickets
      await prizePool.mock.redeemedTickets.withArgs(toWei('10')).returns()

      // credit user
      await interestTracker.mock.totalSupply.returns(toWei('10'))
      await interestTracker.mock.redeemCollateral.withArgs(toWei('10')).returns(toWei('10'))
      await interestTracker.mock.exchangeRateMantissa.returns(toWei('1'));
      await sponsorshipCredit.mock.mint.withArgs(wallet._address, toWei('10')).returns()

      await yieldService.mock.redeem.withArgs(toWei('10')).returns()

      await token.mock.transfer.withArgs(wallet._address, toWei('10')).returns(true)

      await expect(sponsorship.connect(wallet2).operatorRedeem(wallet._address, toWei('10'), []))
        .to.emit(sponsorship, 'SponsorshipRedeemed')
        .withArgs(wallet2._address, wallet._address, toWei('10'))
    })

    it('should not allow an unapproved operator to redeem on behalf of a sponsor', async () => {
      await sponsorship.setInterestSharesForTest(wallet._address, toWei('10'))
      await sponsorship.mintForTest(wallet._address, toWei('10'))

      await expect(sponsorship.connect(wallet2).operatorRedeem(wallet._address, toWei('10'), []))
        .to.be.revertedWith('TokenModule/Invalid operator');
    })
  })

  describe('mint()', () => {
    it('should allow a Module to mint sponsorship tokens')
    it('should allow the Module Manager to mint sponsorship tokens')
  })

  describe('burn()', () => {
    it('should allow a Module to burn sponsorship tokens')
    it('should allow the Module Manager to burn sponsorship tokens')
  })

  describe('sweep()', () => {
    it('should allow anyone to sweep for a list of users')
  })

});
