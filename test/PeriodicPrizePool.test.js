const { deployContract, deployMockContract } = require('ethereum-waffle')
const { deploy1820 } = require('deploy-eip-1820')
const MockGovernor = require('../build/MockGovernor.json')
const RNGServiceMock = require('../build/RNGServiceMock.json')
const MockPrizeStrategy = require('../build/MockPrizeStrategy.json')
const CompoundPeriodicPrizePoolHarness = require('../build/CompoundPeriodicPrizePoolHarness.json')
const Ticket = require('../build/Ticket.json')
const ControlledToken = require('../build/ControlledToken.json')
const CTokenInterface = require('../build/CTokenInterface.json')

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

  const _mocksForTokens = async () => {
    await cToken.mock.underlying.returns(cToken.address)

    await ticket.mock.controllerMint.returns()
    await ticketCredit.mock.controllerMint.returns()
    await sponsorship.mock.controllerMint.returns()
    await sponsorshipCredit.mock.controllerMint.returns()

    await ticket.mock.controllerBurn.returns()
    await ticketCredit.mock.controllerBurn.returns()
    await sponsorship.mock.controllerBurn.returns()
    await sponsorshipCredit.mock.controllerBurn.returns()
  }

  const _mocksForSponsorshipSupply = async ({supply, account = wallet}) => {
    await cToken.mock.transferFrom.withArgs(account._address, prizePool.address, supply).returns(true)
  }

  const _mocksForSponsorshipRedeem = async ({redeem, transfer, account = wallet}) => {
    await cToken.mock.redeemUnderlying.withArgs(redeem).returns(redeem)
    await cToken.mock.transfer.withArgs(account._address, transfer).returns(true)
  }

  const _mocksForSponsorshipSweep = async ({totalSupply, redeemCollateral, credit = toWei('0'), account = wallet}) => {
    await cToken.mock.balanceOfUnderlying.returns(totalSupply)
    await sponsorship.mock.balanceOf.withArgs(account._address).returns(redeemCollateral)
  }


  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()

    debug(`using wallet ${wallet._address}`)

    debug('deploying registry...')
    registry = await deploy1820(wallet)

    debug('deploying protocol governor...')
    governor = await deployContract(wallet, MockGovernor, [], overrides)

    debug('deploying rng service...')
    rngService = await deployContract(wallet, RNGServiceMock, [], overrides)

    debug('deploying prize strategy...')
    prizeStrategy = await deployContract(wallet, MockPrizeStrategy, [], overrides)
  
    debug('mocking tokens...')
    cToken = await deployMockContract(wallet, CTokenInterface.abi, overrides)
    ticket = await deployMockContract(wallet, Ticket.abi, overrides)
    ticketCredit = await deployMockContract(wallet, ControlledToken.abi, overrides)
    sponsorship = await deployMockContract(wallet, ControlledToken.abi, overrides)
    sponsorshipCredit = await deployMockContract(wallet, ControlledToken.abi, overrides)

    // Common Mocks for Tokens
    await _mocksForTokens()

    debug('deploying prizePool...')
    prizePool = await deployContract(wallet, CompoundPeriodicPrizePoolHarness, [], overrides)
    debug({prizePoolAddress: prizePool.address})

    debug('initializing prizePool...')
    await prizePool.initialize(
      FORWARDER,
      governor.address,
      prizeStrategy.address,
      rngService.address,
      prizePeriodSeconds,
      cToken.address
    )
    debug('setting prizePool tokens...')
    await prizePool.setTokens(
      ticket.address,
      sponsorship.address,
      ticketCredit.address,
      sponsorshipCredit.address
    )
  })

  describe('initialize()', () => {
    it('should set the params', async () => {
      expect(await prizePool.governor()).to.equal(governor.address)
      expect(await prizePool.prizeStrategy()).to.equal(prizeStrategy.address)
      expect(await prizePool.rng()).to.equal(rngService.address)
      expect(await prizePool.prizePeriodSeconds()).to.equal(prizePeriodSeconds)
      expect(await prizePool.getTrustedForwarder()).to.equal(FORWARDER)
    })
  })

  describe('setTokens()', () => {
    it('should set the token addresses', async () => {
      expect(await prizePool.ticket()).to.equal(ticket.address)
      expect(await prizePool.sponsorship()).to.equal(sponsorship.address)
      expect(await prizePool.ticketCredit()).to.equal(ticketCredit.address)
      expect(await prizePool.sponsorshipCredit()).to.equal(sponsorshipCredit.address)
    })
  })

  describe('supply()', () => {
    it('should mint sponsorship tokens', async () => {
      const supplyAmount = toWei('10')

      await _mocksForSponsorshipSupply({
        supply: supplyAmount, 
        collateral: supplyAmount,
      })

      await _mocksForSponsorshipSweep({
        totalSupply: supplyAmount, 
        redeemCollateral: supplyAmount, 
      })

      // Supply sponsorship
      await expect(prizePool.supplySponsorship(wallet._address, supplyAmount))
        .to.emit(prizePool, 'SponsorshipSupplied')
        .withArgs(wallet._address, wallet._address, supplyAmount)

      expect(await prizePool.balanceOfSponsorshipInterestShares(wallet._address)).to.equal(supplyAmount)
    })
  })

  describe('redeemSponsorship()', () => {
    it('should allow a sponsor to redeem their sponsorship tokens', async () => {
      const amount = toWei('10')

      // Pre-fund Prize-Pool
      await prizePool.supplyCollateralForTest(amount)
      await prizePool.setSponsorshipInterestSharesForTest(wallet._address, amount)

      await _mocksForSponsorshipSweep({
        totalSupply: toWei('0'),   // avoid poke() from doubling the "amount"
        redeemCollateral: amount, 
      })

      await _mocksForSponsorshipRedeem({
        redeem: amount, 
        transfer: amount,
      })

      // Test redeemSponsorship
      await expect(prizePool.redeemSponsorship(amount))
        .to.emit(prizePool, 'SponsorshipRedeemed')
        .withArgs(wallet._address, wallet._address, amount)
    })

    it('should not allow a sponsor to redeem more sponsorship tokens than they hold', async () => {
      const amount = toWei('10')

      // Pre-fund Prize-Pool
      await prizePool.supplyCollateralForTest(amount)
      await prizePool.setSponsorshipInterestSharesForTest(wallet._address, amount)

      // Test revert
      await expect(prizePool.redeemSponsorship(amount.mul(2)))
        .to.be.revertedWith('Insufficient balance')
    })
  })

  describe('operatorRedeemSponsorship()', () => {
    it('should allow an operator to redeem on behalf of a sponsor their sponsorship tokens'/*, async () => {
      const amount = toWei('10')

      // Pre-fund Prize-Pool
      await prizePool.supplyCollateralForTest(amount)
      await prizePool.setSponsorshipInterestSharesForTest(wallet._address, amount)

      await _mocksForSponsorshipSweep({
        totalSupply: toWei('0'),   // avoid poke() from doubling the "amount"
        redeemCollateral: amount, 
      })

      await _mocksForSponsorshipRedeem({
        redeem: amount, 
        transfer: amount,
      })

      // approved operator
      await sponsorship.mock.isOperatorFor(wallet2._address, wallet._address).returns(true)

      // Test operator redeem
      await expect(prizePool.connect(wallet2).operatorRedeemSponsorship(wallet._address, amount))
        .to.emit(prizePool, 'SponsorshipRedeemed')
        .withArgs(wallet2._address, wallet._address, amount)
    }*/)

    it('should not allow an unapproved operator to redeem on behalf of a sponsor'/*, async () => {
      const amount = toWei('10')

      // Pre-fund Prize-Pool
      await prizePool.supplyCollateralForTest(amount)
      await prizePool.setSponsorshipInterestSharesForTest(wallet._address, amount)

      // unapproved operator
      debug({sponsorshipMock: sponsorship.mock.isOperatorFor})
      await sponsorship.mock.isOperatorFor(wallet2._address, wallet._address).returns(false)

      // Test redeem revert
      await expect(prizePool.connect(wallet2).operatorRedeemSponsorship(wallet._address, amount))
        .to.be.revertedWith('TokenModule/Invalid operator');
    }*/)
  })

  describe('sweepSponsorship()', () => {
    it('should allow anyone to sweep sponsorship for a list of users', async () => {
      const amounts = [toWei('10'), toWei('98765'), toWei('100'), toWei('100000000'), toWei('10101101')]
      const iterableAccounts = getIterable(await buidler.ethers.getSigners(), amounts.length)
      const accountAddresses = []
      const interestAmount = toWei('1')
      let totalSupply = toWei('0')

      // TotalSupply = 0
      await cToken.mock.balanceOfUnderlying.returns(totalSupply)

      // Pre-fund sponsorship tokens *with interest*
      for await (let user of iterableAccounts()) {
        await prizePool.supplyCollateralForTest(amounts[user.index])
        await prizePool.setSponsorshipInterestSharesForTest(user.data._address, amounts[user.index].add(interestAmount)) // + interest

        accountAddresses.push(user.data._address)
        totalSupply = totalSupply.add(amounts[user.index])
      }

      // TotalSupply = Sum of all Balances
      await cToken.mock.balanceOfUnderlying.returns(totalSupply)

      // Mocks for multiple accounts
      for await (let user of iterableAccounts()) {
        await sponsorship.mock.balanceOf.withArgs(user.data._address).returns(amounts[user.index])

        await _mocksForSponsorshipRedeem({
          account: user.data,
          redeem: amounts[user.index], 
          transfer: amounts[user.index],
        })
      }

      // Sweep for multiple accounts
      await prizePool.sweepSponsorship(accountAddresses)

      // Test balances; all interest swept
      for await (let user of iterableAccounts()) {
        expect(await prizePool.balanceOfSponsorshipInterestShares(user.data._address)).to.equal(amounts[user.index]) // "interestAmount" swept
      }
    })
  })

});




