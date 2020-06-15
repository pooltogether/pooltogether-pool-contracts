const { deployContract, deployMockContract } = require('ethereum-waffle')
const { deploy1820 } = require('deploy-eip-1820')
<<<<<<< HEAD
<<<<<<< HEAD
const SponsorshipHarness = require('../build/SponsorshipHarness.json')
=======
const Sponsorship = require('../build/SponsorshipHarness.json')
>>>>>>> Add unit-tests for Sponsorship contract (WIP)
=======
const Sponsorship = require('../build/SponsorshipHarness.json')
>>>>>>> Add unit-tests for Sponsorship contract (WIP)
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
<<<<<<< HEAD
<<<<<<< HEAD
const getIterable = require('./helpers/iterable')
=======
>>>>>>> Add unit-tests for Sponsorship contract (WIP)
=======
>>>>>>> Add unit-tests for Sponsorship contract (WIP)
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

<<<<<<< HEAD
<<<<<<< HEAD
  const _mocksForSupply = async ({supply, mintedTickets, collateral, account = wallet}) => {
    await token.mock.transferFrom.withArgs(account._address, sponsorship.address, supply).returns(true)
      
    // ensure yield service approved
    await token.mock.allowance.returns(0)
    await token.mock.approve.returns(true)
    
    // supply to yield service
    await yieldService.mock.supply.withArgs(supply).returns()
    await prizePool.mock.mintedTickets.withArgs(mintedTickets).returns()
    await interestTracker.mock.supplyCollateral.withArgs(collateral).returns(collateral)
  }

  const _mocksForRedeem = async ({redeem, redeemedTickets, transfer, account = wallet}) => {
    await prizePool.mock.redeemedTickets.withArgs(redeemedTickets).returns()
    await yieldService.mock.redeem.withArgs(redeem).returns()
    await token.mock.transfer.withArgs(account._address, transfer).returns(true)
  }

  const _mocksForSweep = async ({totalSupply, redeemCollateral, credit, account = wallet, exchangeRate = toWei('1')}) => {
      await interestTracker.mock.totalSupply.returns(totalSupply)
      await interestTracker.mock.redeemCollateral.withArgs(redeemCollateral).returns(redeemCollateral)
      await interestTracker.mock.exchangeRateMantissa.returns(exchangeRate);
      await sponsorshipCredit.mock.mint.withArgs(account._address, credit).returns()
  }


=======
>>>>>>> Add unit-tests for Sponsorship contract (WIP)
=======
>>>>>>> Add unit-tests for Sponsorship contract (WIP)
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

<<<<<<< HEAD
<<<<<<< HEAD
    sponsorship = await deployContract(wallet, SponsorshipHarness, [], overrides)
=======
    sponsorship = await deployContract(wallet, Sponsorship, [], overrides)
>>>>>>> Add unit-tests for Sponsorship contract (WIP)
=======
    sponsorship = await deployContract(wallet, Sponsorship, [], overrides)
>>>>>>> Add unit-tests for Sponsorship contract (WIP)

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
<<<<<<< HEAD
<<<<<<< HEAD
      const sweepAmount = toWei('0')
      const supplyAmount = toWei('10')

      await _mocksForSupply({
        supply: supplyAmount, 
        mintedTickets: supplyAmount, 
        collateral: supplyAmount,
      })

      await _mocksForSweep({
        totalSupply: sweepAmount, 
        redeemCollateral: sweepAmount, 
        credit: sweepAmount,
      })

      // Supply sponsorship
      await sponsorship.supply(wallet._address, supplyAmount)

      // Test supply
      expect(await sponsorship.balanceOfInterestShares(wallet._address)).to.equal(supplyAmount)
      expect(await sponsorship.balanceOf(wallet._address)).to.equal(supplyAmount)
=======
=======
>>>>>>> Add unit-tests for Sponsorship contract (WIP)
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
<<<<<<< HEAD
>>>>>>> Add unit-tests for Sponsorship contract (WIP)
=======
>>>>>>> Add unit-tests for Sponsorship contract (WIP)
    })
  })

  describe('redeem()', () => {
    it('should allow a sponsor to redeem their sponsorship tokens', async () => {
<<<<<<< HEAD
<<<<<<< HEAD
      const amount = toWei('10')

      // Pre-fund sponsorship tokens
      await sponsorship.setInterestSharesForTest(wallet._address, amount)
      await sponsorship.mintForTest(wallet._address, amount)

      await _mocksForSweep({
        totalSupply: amount, 
        redeemCollateral: amount, 
        credit: toWei('0'),
      })

      await _mocksForRedeem({
        redeem: amount, 
        redeemedTickets: amount, 
        transfer: amount,
      })

      // Test redeem
      await expect(sponsorship.redeem(amount))
        .to.emit(sponsorship, 'SponsorshipRedeemed')
        .withArgs(wallet._address, wallet._address, amount)
    })

    it('should not allow a sponsor to redeem more sponsorship tokens than they hold', async () => {
      const amount = toWei('10')

      // Pre-fund sponsorship tokens
      await sponsorship.setInterestSharesForTest(wallet._address, amount)

      // Test balance revert
      await expect(sponsorship.redeem(amount.mul(2)))
        .to.be.revertedWith('Sponsorship/insuff')
=======
=======
>>>>>>> Add unit-tests for Sponsorship contract (WIP)
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
<<<<<<< HEAD
>>>>>>> Add unit-tests for Sponsorship contract (WIP)
=======
>>>>>>> Add unit-tests for Sponsorship contract (WIP)
    })
  })

  describe('operatorRedeem()', () => {
    it('should allow an operator to redeem on behalf of a sponsor their sponsorship tokens', async () => {
<<<<<<< HEAD
<<<<<<< HEAD
      const amount = toWei('10')

      // Pre-fund sponsorship tokens
      await sponsorship.setInterestSharesForTest(wallet._address, amount)
      await sponsorship.mintForTest(wallet._address, amount)

      await _mocksForSweep({
        totalSupply: amount, 
        redeemCollateral: amount, 
        credit: toWei('0'),
      })

      await _mocksForRedeem({
        redeem: amount, 
        redeemedTickets: amount, 
        transfer: amount,
      })

      // approve operator
      await sponsorship.authorizeOperator(wallet2._address)

      // Test operator redeem
      await expect(sponsorship.connect(wallet2).operatorRedeem(wallet._address, amount))
        .to.emit(sponsorship, 'SponsorshipRedeemed')
        .withArgs(wallet2._address, wallet._address, amount)
    })

    it('should not allow an unapproved operator to redeem on behalf of a sponsor', async () => {
      const amount = toWei('10')

      // Pre-fund sponsorship tokens
      await sponsorship.setInterestSharesForTest(wallet._address, amount)
      await sponsorship.mintForTest(wallet._address, amount)

      // Test redeem revert
      await expect(sponsorship.connect(wallet2).operatorRedeem(wallet._address, amount))
=======
=======
>>>>>>> Add unit-tests for Sponsorship contract (WIP)
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
<<<<<<< HEAD
>>>>>>> Add unit-tests for Sponsorship contract (WIP)
=======
>>>>>>> Add unit-tests for Sponsorship contract (WIP)
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
<<<<<<< HEAD
<<<<<<< HEAD
    it('should allow anyone to sweep for a list of users', async () => {
      const numAccounts = 5
      const iterableAccounts = getIterable(await buidler.ethers.getSigners(), numAccounts)
      const amounts = [toWei('10'), toWei('98765'), toWei('100'), toWei('100000000'), toWei('10101101')]
      const accountAddresses = []
      const interestAmount = toWei('1')
      let totalSupply = toWei('0')

      // Pre-fund sponsorship tokens *with interest*
      for await (let user of iterableAccounts()) {
        await sponsorship.mintForTest(user.data._address, amounts[user.index])
        await sponsorship.setInterestSharesForTest(user.data._address, amounts[user.index].add(interestAmount))

        accountAddresses.push(user.data._address)
        totalSupply = totalSupply.add(amounts[user.index])
      }
      debug({accountAddresses})

      // Mocks for multiple accounts
      for await (let user of iterableAccounts()) {
        await _mocksForSweep({
          account: user.data,
          totalSupply: totalSupply, 
          redeemCollateral: interestAmount,
          credit: interestAmount,
        })

        await _mocksForRedeem({
          account: user.data,
          redeem: amounts[user.index], 
          redeemedTickets: amounts[user.index], 
          transfer: amounts[user.index],
        })
        totalSupply = totalSupply.sub(amounts[user.index])
      }

      // Sweep for multiple accounts
      await expect(sponsorship.sweep(accountAddresses))
        .to.emit(sponsorship, 'SponsorshipSwept')
        .withArgs(wallet._address, accountAddresses)

      // Test balances; all interest swept
      for await (let user of iterableAccounts()) {
        expect(await sponsorship.balanceOfInterestShares(user.data._address)).to.equal(amounts[user.index]) // "interestAmount" swept
        expect(await sponsorship.balanceOf(user.data._address)).to.equal(amounts[user.index])
      }
    })
=======
    it('should allow anyone to sweep for a list of users')
>>>>>>> Add unit-tests for Sponsorship contract (WIP)
=======
    it('should allow anyone to sweep for a list of users')
>>>>>>> Add unit-tests for Sponsorship contract (WIP)
  })

});
