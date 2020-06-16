const { deployContract, deployMockContract } = require('ethereum-waffle')
const { deploy1820 } = require('deploy-eip-1820')
const MockGovernor = require('../build/MockGovernor.json')
const RNGServiceMock = require('../build/RNGServiceMock.json')
const MockPrizeStrategy = require('../build/MockPrizeStrategy.json')
const PeriodicPrizePool = require('../build/PeriodicPrizePool.json')
const Ticket = require('../build/Ticket.json')
const ControlledToken = require('../build/ControlledToken.json')
const IERC20 = require('../build/IERC20.json')

const { ethers } = require('./helpers/ethers')
const { expect } = require('chai')
const buidler = require('./helpers/buidler')
const getIterable = require('./helpers/iterable')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:PeriodicPrizePool.test')

const FORWARDER = '0x5f48a3371df0F8077EC741Cc2eB31c84a4Ce332a'

let overrides = { gasLimit: 20000000 }


describe.only('PeriodicPrizePool contract', function() {
  let wallet, wallet2

  let registry, governor, rngService, prizePool, prizeStrategy, cToken

  let ticket, ticketCredit, sponsorship, sponsorshipCredit

  let prizePeriodSeconds = toWei('1000')

  // const _mocksForSponsorshipSupply = async ({supply, mintedTickets, collateral, account = wallet}) => {
  //   await cToken.mock.transferFrom.withArgs(account._address, sponsorship.address, supply).returns(true)
      
  //   // ensure yield service approved
  //   await cToken.mock.allowance.returns(0)
  //   await cToken.mock.approve.returns(true)
    
  //   // supply to yield service
  //   await yieldService.mock.supply.withArgs(supply).returns()
  //   await prizePool.mock.mintedTickets.withArgs(mintedTickets).returns()
  //   await interestTracker.mock.supplyCollateral.withArgs(collateral).returns(collateral)
  // }

  // const _mocksForSponsorshipRedeem = async ({redeem, redeemedTickets, transfer, account = wallet}) => {
  //   await prizePool.mock.redeemedTickets.withArgs(redeemedTickets).returns()
  //   await yieldService.mock.redeem.withArgs(redeem).returns()
  //   await cToken.mock.transfer.withArgs(account._address, transfer).returns(true)
  // }

  // const _mocksForSponsorshipSweep = async ({totalSupply, redeemCollateral, credit, account = wallet, exchangeRate = toWei('1')}) => {
  //     await interestTracker.mock.totalSupply.returns(totalSupply)
  //     await interestTracker.mock.redeemCollateral.withArgs(redeemCollateral).returns(redeemCollateral)
  //     await interestTracker.mock.exchangeRateMantissa.returns(exchangeRate);
  //     await sponsorshipCredit.mock.mint.withArgs(account._address, credit).returns()
  // }


  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()

    debug(`using wallet ${wallet._address}`)

    debug('deploying registry...')
    registry = await deploy1820(wallet)

    debug('mocking protocol governor...')
    governor = await deployContract(wallet, MockGovernor, overrides)

    debug('mocking prizeStrategy...')
    rngService = await deployContract(wallet, RNGServiceMock, overrides)

    debug('mocking prizeStrategy...')
    prizeStrategy = await deployContract(wallet, MockPrizeStrategy, overrides)
  
    debug('mocking tokens...')
    cToken = await deployMockContract(wallet, IERC20.abi, overrides)
    ticket = await deployMockContract(wallet, Ticket.abi, overrides)
    ticketCredit = await deployMockContract(wallet, ControlledToken.abi, overrides)
    sponsorship = await deployMockContract(wallet, ControlledToken.abi, overrides)
    sponsorshipCredit = await deployMockContract(wallet, ControlledToken.abi, overrides)

    debug('deploying prizePool...')
    prizePool = await deployContract(wallet, PeriodicPrizePool, [], overrides)

    debug('initializing prizePool...')
    await prizePool.initialize(
      FORWARDER,
      governor.address,
      prizeStrategy.address,
      rngService.address,
      prizePeriodSeconds
    )
    await prizePool.setTokens(
      ticket.address,
      ticketCredit.address,
      sponsorship.address,
      sponsorshipCredit.address
    )
  })

  describe.only('initialize()', () => {
    it('should set the params', async () => {
      expect(await sponsorship.name()).to.equal('SPONSORSHIP')
      expect(await sponsorship.symbol()).to.equal('SPON')
      expect(await sponsorship.getTrustedForwarder()).to.equal(FORWARDER)
    })
  })

  describe('supply()', () => {
    it('should mint sponsorship tokens', async () => {
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
    })
  })

  describe('redeem()', () => {
    it('should allow a sponsor to redeem their sponsorship tokens', async () => {
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
    })
  })

  describe('operatorRedeem()', () => {
    it('should allow an operator to redeem on behalf of a sponsor their sponsorship tokens', async () => {
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
  })

});




