const { deployContract, deployMockContract } = require('ethereum-waffle')
const CompoundPrizePoolHarness = require('../build/CompoundPrizePoolHarness.json')
const PrizeStrategyInterface = require('../build/PrizeStrategyInterface.json')
const ControlledToken = require('../build/ControlledToken.json')
const CTokenInterface = require('../build/CTokenInterface.json')
const IERC20 = require('../build/IERC20.json')

const { ethers } = require('./helpers/ethers')
const { expect } = require('chai')
const buidler = require('./helpers/buidler')
const { call } = require('./helpers/call')
const { AddressZero } = require('ethers/constants')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:PrizePool.test')

let overrides = { gasLimit: 20000000 }

const FORWARDER = '0x5f48a3371df0F8077EC741Cc2eB31c84a4Ce332a'

describe('CompoundPrizePool', function() {
  let wallet, wallet2

  let prizePool, token, cToken, prizeStrategy
  let multiTokenPrizePool, multiTokenPrizeStrategy

  let ticket, sponsorship

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()
    debug(`using wallet ${wallet._address}`)

    debug('mocking tokens...')
    token = await deployMockContract(wallet, IERC20.abi, overrides)
    cToken = await deployMockContract(wallet, CTokenInterface.abi, overrides)
    await cToken.mock.underlying.returns(token.address)

    prizeStrategy = await deployMockContract(wallet, PrizeStrategyInterface.abi, overrides)

    debug('deploying CompoundPrizePoolHarness...')
    prizePool = await deployContract(wallet, CompoundPrizePoolHarness, [], overrides)

    ticket = await deployMockContract(wallet, ControlledToken.abi, overrides)
    await ticket.mock.controller.returns(prizePool.address)
  })

  describe('with a mocked prize pool', () => {
    beforeEach(async () => {
      await prizePool.initializeAll(
        FORWARDER,
        prizeStrategy.address,
        [ticket.address],
        toWei('0.5'),    // Max Exit Fee
        '10000', // Max Timelock
        cToken.address
      )
    })

    describe('initialize()', () => {
      it('should set all the vars', async () => {
        expect(await prizePool.cToken()).to.equal(cToken.address)
        expect(await prizePool.token()).to.equal(token.address)
      })
    })

    describe('depositTo()', () => {
      it('should mint timelock tokens to the user', async () => {
        const amount = toWei('11')

        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns('0')

        await token.mock.transferFrom.withArgs(wallet._address, prizePool.address, amount).returns(true)
        await token.mock.approve.withArgs(cToken.address, amount).returns(true)
        await cToken.mock.mint.withArgs(amount).returns('0')
        await prizeStrategy.mock.afterDepositTo.withArgs(wallet2._address, amount, ticket.address).returns()
        await ticket.mock.controllerMint.withArgs(wallet2._address, amount).returns()

        // Test depositTo
        await expect(prizePool.depositTo(wallet2._address, amount, ticket.address))
          .to.emit(prizePool, 'Deposited')
          .withArgs(wallet._address, wallet2._address, ticket.address, amount)

      })
    })

    describe('withdrawInstantlyFrom()', () => {
      it('should allow a user to withdraw instantly', async () => {
        let amount = toWei('11')

        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns('0')

        await prizeStrategy.mock.beforeWithdrawInstantlyFrom.withArgs(wallet._address, amount, ticket.address).returns(toWei('1'))
        await ticket.mock.controllerBurnFrom.withArgs(wallet._address, wallet._address, amount).returns()
        await cToken.mock.redeemUnderlying.withArgs(toWei('10')).returns('0')
        await token.mock.transfer.withArgs(wallet._address, toWei('10')).returns(true)
        await prizeStrategy.mock.afterWithdrawInstantlyFrom.withArgs(wallet._address, wallet._address, amount, ticket.address, toWei('1'), '0').returns()

        await expect(prizePool.withdrawInstantlyFrom(wallet._address, amount, ticket.address, '0'))
          .to.emit(prizePool, 'InstantWithdrawal')
          .withArgs(wallet._address, wallet._address, ticket.address, amount, toWei('1'), '0')
      })
    })

    describe('withdrawWithTimelockFrom()', () => {
      it('should allow a user to withdraw with a timelock', async () => {
        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns('0')

        // force current time
        await prizePool.setCurrentTime('1')

        // ensure withdraw is later than now
        await prizeStrategy.mock.beforeWithdrawWithTimelockFrom
          .withArgs(wallet._address, toWei('10'), ticket.address)
          .returns('10')

        // expect a ticket burn
        await ticket.mock.controllerBurnFrom.withArgs(wallet._address, wallet._address, toWei('10')).returns()

        // expect finish
        await prizeStrategy.mock.afterWithdrawWithTimelockFrom.withArgs(wallet._address, toWei('10'), ticket.address).returns()

        // setup timelocked withdrawal
        await prizePool.withdrawWithTimelockFrom(wallet._address, toWei('10'), ticket.address)

        expect(await prizePool.timelockBalanceOf(wallet._address)).to.equal(toWei('10'))
        expect(await prizePool.timelockBalanceAvailableAt(wallet._address)).to.equal('10')
        expect(await prizePool.timelockTotalSupply()).to.equal(toWei('10'))
      })
    })

    describe('sweepTimelockBalances()', () => {
      it('should do nothing when no balances are available', async () => {
        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns('0')

        // ensure sweep is later than now
        await prizeStrategy.mock.beforeWithdrawWithTimelockFrom
          .withArgs(wallet._address, toWei('0'), ticket.address)
          .returns(1000)

        // now execute timelock withdrawal
        await expect(prizePool.sweepTimelockBalances([wallet._address]))
          .not.to.emit(prizePool, 'TimelockedWithdrawalSwept')
          .withArgs(wallet._address, wallet._address, toWei('10'))
      })

      it('should sweep only balances that are unlocked', async () => {
        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns(toWei('33'))
        await ticket.mock.totalSupply.returns('0')

        // force current time
        await prizePool.setCurrentTime('1')

        // expect ticket burns from both
        await ticket.mock.controllerBurnFrom.returns()

        // withdraw for a user, and it's eligible at 10 seconds
        await prizeStrategy.mock.beforeWithdrawWithTimelockFrom.returns(10)
        await prizeStrategy.mock.afterWithdrawWithTimelockFrom.withArgs(wallet._address, toWei('11'), ticket.address).returns()
        await prizePool.withdrawWithTimelockFrom(wallet._address, toWei('11'), ticket.address)

        // withdraw for a user, and it's eligible at 20 seconds
        await prizeStrategy.mock.beforeWithdrawWithTimelockFrom.returns(20)
        await prizeStrategy.mock.afterWithdrawWithTimelockFrom.withArgs(wallet2._address, toWei('22'), ticket.address).returns()
        await prizePool.withdrawWithTimelockFrom(wallet2._address, toWei('22'), ticket.address)

        // Only first deposit is unlocked
        await prizePool.setCurrentTime(15)

        // expect the redeem && transfer for only the unlocked amount
        await cToken.mock.redeemUnderlying.withArgs(toWei('11')).returns('0')
        await token.mock.transfer.withArgs(wallet._address, toWei('11')).returns(true)
        await prizeStrategy.mock.afterSweepTimelockedWithdrawal.withArgs(wallet._address, wallet._address, toWei('11')).returns()

        // Let's sweep
        await expect(prizePool.sweepTimelockBalances([wallet._address, wallet2._address]))
          .to.emit(prizePool, 'TimelockedWithdrawalSwept')
          .withArgs(wallet._address, wallet._address, toWei('11'))

        // first user has cleared
        expect(await prizePool.timelockBalanceOf(wallet._address)).to.equal(toWei('0'))
        expect(await prizePool.timelockBalanceAvailableAt(wallet._address)).to.equal('0')

        // second has not
        expect(await prizePool.timelockBalanceOf(wallet2._address)).to.equal(toWei('22'))
        expect(await prizePool.timelockBalanceAvailableAt(wallet2._address)).to.equal(20)

        expect(await prizePool.timelockTotalSupply()).to.equal(toWei('22'))
      })

      it('should sweep timelock balances that have unlocked', async () => {
        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns('0')

        // force current time
        await prizePool.setCurrentTime('1')

        // ensure withdraw is later than now
        await prizeStrategy.mock.beforeWithdrawWithTimelockFrom
          .withArgs(wallet._address, toWei('10'), ticket.address)
          .returns(10)

        // expect a ticket burn
        await ticket.mock.controllerBurnFrom.withArgs(wallet._address, wallet._address, toWei('10')).returns()

        // expect finish
        await prizeStrategy.mock.afterWithdrawWithTimelockFrom.withArgs(wallet._address, toWei('10'), ticket.address).returns()

        // setup timelocked withdrawal
        await prizePool.withdrawWithTimelockFrom(wallet._address, toWei('10'), ticket.address)

        // expect the redeem && transfer
        await cToken.mock.redeemUnderlying.withArgs(toWei('10')).returns('0')
        await token.mock.transfer.withArgs(wallet._address, toWei('10')).returns(true)
        await prizeStrategy.mock.afterSweepTimelockedWithdrawal.withArgs(wallet._address, wallet._address, toWei('10')).returns()

        // ensure time is after
        await prizePool.setCurrentTime(11)

        // now execute timelock withdrawal
        await expect(prizePool.sweepTimelockBalances([wallet._address]))
          .to.emit(prizePool, 'TimelockedWithdrawalSwept')
          .withArgs(wallet._address, wallet._address, toWei('10'))

        expect(await prizePool.timelockBalanceOf(wallet._address)).to.equal('0')
        expect(await prizePool.timelockBalanceAvailableAt(wallet._address)).to.equal('0')
      })
    })

    describe('estimateAccruedInterestOverBlocks()', () => {
      it('should get the supply rate from the yield service to estimate interest per block', async function () {
        const deposit = toWei('100')
        const supplyRate = toWei('0.001')
        const numBlocks = '10'

        await cToken.mock.supplyRatePerBlock.returns(supplyRate)

        expect(await prizePool.estimateAccruedInterestOverBlocks(deposit, numBlocks)).to.deep.equal(toWei('1'))
      })
    })

    describe('balance()', () => {
      it('should return zero if no deposits have been made', async () => {
        await cToken.mock.balanceOfUnderlying.returns(toWei('11'))

        expect((await call(prizePool, 'balance')).toString()).to.equal(toWei('11'))
      })
    })

    describe('tokens()', () => {
      it('should return all tokens', async () => {
        expect(await prizePool.tokens()).to.deep.equal([ticket.address])
      })
    })

    describe('canAwardExternal', () => {
      it('should allow non-ctoken', async () => {
        expect(await prizePool.canAwardExternal(ticket.address)).to.be.true
      })

      it('should not allow ctoken', async () => {
        expect(await prizePool.canAwardExternal(cToken.address)).to.be.false
      })
    })

    describe('detachPrizeStrategy()', () => {
      it('should allow owner to detach', async () => {
        await prizePool.detachPrizeStrategy()
        expect(await prizePool.prizeStrategy()).to.equal(AddressZero)
      })

      it('should not allow anyone else to call', async () => {
        prizePool2 = prizePool.connect(wallet2)
        await expect(prizePool2.detachPrizeStrategy()).to.be.revertedWith('Ownable: caller is not the owner')
      })
    })
  })

  describe('with a multi-token prize pool', () => {

    beforeEach(async () => {

      debug('deploying CompoundPrizePoolHarness...')
      multiTokenPrizeStrategy = await deployMockContract(wallet, PrizeStrategyInterface.abi, overrides)
      multiTokenPrizePool = await deployContract(wallet, CompoundPrizePoolHarness, [], overrides)

      sponsorship = await deployMockContract(wallet, ControlledToken.abi, overrides)

      await ticket.mock.controller.returns(multiTokenPrizePool.address)
      await sponsorship.mock.controller.returns(multiTokenPrizePool.address)

      await multiTokenPrizePool.initializeAll(
        FORWARDER,
        multiTokenPrizeStrategy.address,
        [ticket.address, sponsorship.address],
        '50',    // Max Exit Fee
        '10000', // Max Timelock
        cToken.address
      )
    })

    describe('accountedBalance()', () => {
      it('should return the total accounted balance for all tokens including timelocked deposits', async () => {
        await ticket.mock.totalSupply.returns(toWei('123'))
        await sponsorship.mock.totalSupply.returns(toWei('456'))
        await multiTokenPrizePool.setTimelockBalance(toWei('789'))

        expect(await multiTokenPrizePool.accountedBalance()).to.equal(toWei('1368'))
      })
    })
  })

  describe('awardExternal()', () => {
    beforeEach(async () => {
      await prizePool.initializeAll(
        FORWARDER,
        wallet._address, // wallet is the prizeStrategy
        [ticket.address],
        '50',    // Max Exit Fee
        '10000', // Max Timelock
        cToken.address
      )
    })

    it('should only allow the prizeStrategy to award external', async () => {
      let prizePool2 = prizePool.connect(wallet2)
      await expect(prizePool2.awardExternal(wallet._address, toWei('10'), FORWARDER)).to.be.revertedWith('PrizePool/only-prizeStrategy')
    })

    it('should require the token to be allowed', async () => {
      await expect(prizePool.awardExternal(wallet._address, toWei('10'), cToken.address)).to.be.revertedWith('PrizePool/invalid-external-token')
    })

    it('should allow arbitrary tokens to be transferred', async () => {
      await token.mock.transfer.withArgs(wallet._address, toWei('10')).returns(true)
      await prizePool.awardExternal(wallet._address, toWei('10'), token.address)
    })
  })

  describe('with a detached prize strategy', () => {
    let detachedPrizePool
    let ticket2

    beforeEach(async () => {
      debug('deploying CompoundPrizePoolHarness...')
      detachedPrizePool = await deployContract(wallet, CompoundPrizePoolHarness, [], overrides)

      debug('deploying ControlledToken...')
      ticket2 = await deployMockContract(wallet, ControlledToken.abi, overrides)
      await ticket2.mock.controller.returns(detachedPrizePool.address)

      debug('initializing PrizePool...')
      await detachedPrizePool.initializeAll(
        FORWARDER,
        wallet._address,    // Prize Strategy
        [ticket2.address],
        '50',    // Max Exit Fee
        '10000', // Max Timelock
        cToken.address
      )

      debug('detaching PrizeStrategy from PrizePool...')
      await detachedPrizePool.detachPrizeStrategy();
    })

    describe('depositTo()', () => {
      it('should NOT mint tokens to the user', async () => {
        await expect(detachedPrizePool.depositTo(wallet2._address, toWei('1'), ticket2.address))
          .to.be.revertedWith('PrizePool/prize-strategy-detached')
      })
    })

    describe('withdrawInstantlyFrom()', () => {
      it('should allow a user to withdraw instantly', async () => {
        let amount = toWei('11')

        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket2.mock.totalSupply.returns('0')

        // await prizeStrategy.mock.calculateInstantWithdrawalFee.withArgs(wallet._address, amount, ticket.address).returns(toWei('1'))
        await ticket2.mock.controllerBurnFrom.withArgs(wallet._address, wallet._address, amount).returns()
        await cToken.mock.redeemUnderlying.withArgs(toWei('11')).returns('0')
        await token.mock.transfer.withArgs(wallet._address, toWei('11')).returns(true)
        // await prizeStrategy.mock.afterWithdrawInstantlyFrom.withArgs(wallet._address, wallet._address, amount, ticket.address, toWei('1'), '0').returns()

        await expect(detachedPrizePool.withdrawInstantlyFrom(wallet._address, amount, ticket2.address, '0'))
          .to.emit(detachedPrizePool, 'InstantWithdrawal')
          .withArgs(wallet._address, wallet._address, ticket2.address, amount, toWei('0'), '0')
      })
    })

    describe('withdrawWithTimelockFrom()', () => {
      it('should allow a user to withdraw with a timelock', async () => {
        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket2.mock.totalSupply.returns('0')

        // force current time
        await detachedPrizePool.setCurrentTime('1')

        // expect a ticket burn
        await ticket2.mock.controllerBurnFrom.withArgs(wallet._address, wallet._address, toWei('10')).returns()
        await cToken.mock.redeemUnderlying.withArgs(toWei('10')).returns('0')

        // full-amount should be tansferred
        await token.mock.transfer.withArgs(wallet._address, toWei('10')).returns(true)
        await detachedPrizePool.withdrawWithTimelockFrom(wallet._address, toWei('10'), ticket2.address)

        expect(await detachedPrizePool.timelockBalanceOf(wallet._address)).to.equal(toWei('0'))
        expect(await detachedPrizePool.timelockBalanceAvailableAt(wallet._address)).to.equal('0')
        expect(await detachedPrizePool.timelockTotalSupply()).to.equal(toWei('0'))
      })
    })
  })
});
