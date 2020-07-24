const { deployContract } = require('ethereum-waffle')
const { deployMockContract } = require('./helpers/deployMockContract')
const { call, callRaw } = require('./helpers/call')
const { deploy1820 } = require('deploy-eip-1820')
const GovernorInterface = require('../build/GovernorInterface.json')
const PrizeStrategyHarness = require('../build/PrizeStrategyHarness.json')
const PrizePool = require('../build/PrizePool.json')
const RNGInterface = require('../build/RNGInterface.json')
const IERC20 = require('../build/IERC20.json')
const ControlledToken = require('../build/ControlledToken.json')

const { expect } = require('chai')
const buidler = require('./helpers/buidler')
const { AddressZero, Zero } = require('ethers/constants')
const toWei = (val) => ethers.utils.parseEther('' + val)
const debug = require('debug')('ptv3:PeriodicPrizePool.test')

const FORWARDER = '0x5f48a3371df0F8077EC741Cc2eB31c84a4Ce332a'

let overrides = { gasLimit: 20000000 }

describe('PrizeStrategy', function() {
  let wallet, wallet2

  let registry, governor, prizePool, prizeStrategy, token, externalAward

  let ticket, sponsorship, rng

  let prizePeriodSeconds = 1000

  let exitFeeMantissa = 0.1
  let creditRateMantissa = 0.01

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()

    debug(`using wallet ${wallet._address}`)

    debug('deploying registry...')
    registry = await deploy1820(wallet)

    debug('deploying protocol governor...')
    governor = await deployMockContract(wallet, GovernorInterface.abi, [], overrides)

    debug('mocking tokens...')
    token = await deployMockContract(wallet, IERC20.abi, overrides)
    prizePool = await deployMockContract(wallet, PrizePool.abi, overrides)
    ticket = await deployMockContract(wallet, ControlledToken.abi, overrides)
    sponsorship = await deployMockContract(wallet, ControlledToken.abi, overrides)
    rng = await deployMockContract(wallet, RNGInterface.abi, overrides)
    externalAward = await deployMockContract(wallet, IERC20.abi, overrides)

    debug('deploying prizeStrategy...')
    prizeStrategy = await deployContract(wallet, PrizeStrategyHarness, [], overrides)

    await prizePool.mock.canAwardExternal.withArgs(externalAward.address).returns(true)

    debug('initializing prizeStrategy...')
    await prizeStrategy.initialize(
      FORWARDER,
      governor.address,
      prizePeriodSeconds,
      prizePool.address,
      ticket.address,
      sponsorship.address,
      rng.address,
      toWei('' + exitFeeMantissa),
      toWei('' + creditRateMantissa).div(prizePeriodSeconds),
      [externalAward.address]
    )

    debug('initialized!')
  })

  describe('initialize()', () => {
    it('should set the params', async () => {
      expect(await prizeStrategy.getTrustedForwarder()).to.equal(FORWARDER)
      expect(await prizeStrategy.governor()).to.equal(governor.address)
      expect(await prizeStrategy.prizePool()).to.equal(prizePool.address)
      expect(await prizeStrategy.prizePeriodSeconds()).to.equal(prizePeriodSeconds)
      expect(await prizeStrategy.ticket()).to.equal(ticket.address)
      expect(await prizeStrategy.sponsorship()).to.equal(sponsorship.address)
      expect(await prizeStrategy.rng()).to.equal(rng.address)
    })

    it('should disallow unapproved external prize tokens', async () => {
      const invalidExternalToken = '0x0000000000000000000000000000000000000001'
      const initArgs = [
        FORWARDER,
        governor.address,
        prizePeriodSeconds,
        prizePool.address,
        ticket.address,
        sponsorship.address,
        rng.address,
        toWei('0.1'),
        toWei('0.1').div(prizePeriodSeconds),
        [invalidExternalToken]
      ]

      debug('deploying secondary prizeStrategy...')
      const prizeStrategy2 = await deployContract(wallet, PrizeStrategyHarness, [], overrides)

      debug('initializing secondary prizeStrategy...')
      await prizePool.mock.canAwardExternal.withArgs(invalidExternalToken).returns(false)
      await expect(prizeStrategy2.initialize(...initArgs))
        .to.be.revertedWith('PrizeStrategy/cannot-award-external')
    })
  })

  describe('currentPrize()', () => {
    it('should return the currently accrued interest when reserve is zero', async () => {
      await prizePool.mock.awardBalance.returns('100')
      await governor.mock.reserve.returns(AddressZero)
      expect(await call(prizeStrategy, 'currentPrize')).equal('100')
    })

    it('should return the interest accrued less the reserve when the reserve is non-zero', async () => {
      await prizePool.mock.awardBalance.returns('100')
      await governor.mock.reserve.returns(FORWARDER)
      await governor.mock.reserveFeeMantissa.returns(toWei('0.1'))
      expect(await call(prizeStrategy, 'currentPrize')).equal('90')
    })
  })

  describe('estimatePrize()', () => {
    it('should calculate the estimated prize', async () => {
      await prizeStrategy.setCurrentTime(await prizeStrategy.prizePeriodStartedAt())
      await prizePool.mock.awardBalance.returns('100')
      await prizePool.mock.accountedBalance.returns('1000')
      await governor.mock.reserve.returns(AddressZero)
      await prizePool.mock.estimateAccruedInterestOverBlocks
        .returns('10')

      expect(await call(prizeStrategy, 'estimatePrize')).to.equal('110')
    })
  })

  describe('setCreditRateMantissa', () => {
    it('should only allow the owner to change it', async () => {
      await expect(prizeStrategy.setCreditRateMantissa(toWei('0.1')))
        .to.emit(prizeStrategy, 'CreditRateUpdated')
        .withArgs(toWei('0.1'))
    })

    it('should not allow anyone but the owner to change', async () => {
      prizeStrategy2 = prizeStrategy.connect(wallet2)
      await expect(prizeStrategy2.setCreditRateMantissa(toWei('0.1'))).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('setExitFeeMantissa', () => {
    it('should only allow the owner to change it', async () => {
      await expect(prizeStrategy.setExitFeeMantissa(toWei('0.1')))
        .to.emit(prizeStrategy, 'ExitFeeUpdated')
        .withArgs(toWei('0.1'))
    })

    it('should not allow anyone but the owner to change', async () => {
      prizeStrategy2 = prizeStrategy.connect(wallet2)
      await expect(prizeStrategy2.setExitFeeMantissa(toWei('0.1'))).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('estimatePrizeWithBlockTime()', () => {
    it('should calculate the estimated prize', async () => {
      await prizeStrategy.setCurrentTime(await prizeStrategy.prizePeriodStartedAt())
      await prizePool.mock.awardBalance.returns('100')
      await prizePool.mock.accountedBalance.returns('1000')
      await governor.mock.reserve.returns(AddressZero)
      await prizePool.mock.estimateAccruedInterestOverBlocks
        .withArgs('1000', toWei('10'))
        .returns('10')

      expect(await call(prizeStrategy, 'estimatePrizeWithBlockTime', 100)).to.equal('110')
    })
  })

  describe('calculateInstantWithdrawalFee()', () => {
    it('should calculate fee for instant withdrawal with no credit', async () => {
      const withdrawalAmount = 50
      const exitFee = withdrawalAmount * exitFeeMantissa
      await ticket.mock.balanceOf.withArgs(wallet._address).returns(toWei('100'))

      expect(await call(prizeStrategy, 'balanceOfCredit', wallet._address)).to.equal('0')

      let fees = await callRaw(prizeStrategy, 'calculateInstantWithdrawalFee', wallet._address, toWei(withdrawalAmount), ticket.address)
      expect(fees.remainingFee).to.equal(toWei(exitFee))
      expect(fees.burnedCredit).to.equal('0')
    })
  })

  describe('calculateTimelockDurationAndFee()', () => {
    it('should calculate timelock duration for scheduled withdrawals with no credit', async () => {
      const timelockDuration = prizePeriodSeconds / exitFeeMantissa
      await ticket.mock.balanceOf.withArgs(wallet._address).returns(toWei('100'))

      expect(await call(prizeStrategy, 'balanceOfCredit', wallet._address)).to.equal('0')

      let fees = await callRaw(prizeStrategy, 'calculateTimelockDurationAndFee', wallet._address, toWei('50'), ticket.address)
      expect(fees.durationSeconds).to.equal('' + timelockDuration)
      expect(fees.burnedCredit).to.equal('0')
    })
  })

  describe('chanceOf()', () => {
    it('should show the odds for a user to win the prize', async () => {
      const amount = toWei('10')
      await ticket.mock.balanceOf.withArgs(wallet._address).returns(amount)
      await prizePool.call(prizeStrategy, 'afterDepositTo', wallet._address, amount, ticket.address)
      expect(await prizeStrategy.chanceOf(wallet._address)).to.be.equal(amount)
    })
  })

  describe('afterDepositTo()', () => {
    it('should only be called by the prize pool', async () => {
      prizeStrategy2 = await prizeStrategy.connect(wallet2)
      await expect(prizeStrategy2.afterDepositTo(wallet._address, toWei('10'), ticket.address)).to.be.revertedWith('PrizeStrategy/only-prize-pool')
    })

    it('should update the users ticket balance', async () => {
      await ticket.mock.totalSupply.returns('22')
      await ticket.mock.balanceOf.withArgs(wallet._address).returns(toWei('22'))
      await prizePool.call(prizeStrategy, 'afterDepositTo', wallet._address, toWei('10'), ticket.address)
      expect(await prizeStrategy.draw(1)).to.equal(wallet._address) // they exist in the sortition sum tree
    })

    it('should not be called if an rng request is in flight', async () => {
      await rng.mock.requestRandomNumber.returns('11', '1');
      await prizeStrategy.setCurrentTime(await prizeStrategy.prizePeriodEndAt());
      await prizeStrategy.startAward();

      await expect(prizePool.call(prizeStrategy, 'afterDepositTo', wallet._address, toWei('10'), ticket.address))
        .to.be.revertedWith('PrizeStrategy/rng-in-flight');
    });
  });

  describe('afterWithdrawInstantlyFrom()', () => {
    it('should revert if rng request is in flight', async () => {
      await rng.mock.requestRandomNumber.returns('11', '1');
      await prizeStrategy.setCurrentTime(await prizeStrategy.prizePeriodEndAt());
      await prizeStrategy.startAward();

      await expect(
        prizePool.call(
          prizeStrategy,
          'afterWithdrawInstantlyFrom',
          wallet._address,
          wallet._address,
          toWei('10'),
          ticket.address,
          toWei('0'),
          toWei('0')
        ))
        .to.be.revertedWith('PrizeStrategy/rng-in-flight')
    });
  });

  describe("beforeTokenTransfer()", () => {
    it('should allow other token transfers if awarding is happening', async () => {
      await rng.mock.requestRandomNumber.returns('11', '1');
      await prizeStrategy.setCurrentTime(await prizeStrategy.prizePeriodEndAt());
      await prizeStrategy.startAward();

      await prizePool.call(
        prizeStrategy,
        'beforeTokenTransfer(address,address,uint256,address)',
        wallet._address,
        wallet._address,
        toWei('10'),
        wallet._address
      )
    })

    it('should revert on ticket transfer if awarding is happening', async () => {
      await rng.mock.requestRandomNumber.returns('11', '1');
      await prizeStrategy.setCurrentTime(await prizeStrategy.prizePeriodEndAt());
      await prizeStrategy.startAward();

      await expect(
        prizePool.call(
          prizeStrategy,
          'beforeTokenTransfer(address,address,uint256,address)',
          wallet._address,
          wallet._address,
          toWei('10'),
          ticket.address
        ))
        .to.be.revertedWith('PrizeStrategy/rng-in-flight')
    })
  })

  describe("afterWithdrawWithTimelockFrom()", () => {
    it('should revert on ticket transfer if awarding is happening', async () => {
      await rng.mock.requestRandomNumber.returns('11', '1');
      await prizeStrategy.setCurrentTime(await prizeStrategy.prizePeriodEndAt());
      await prizeStrategy.startAward();

      await expect(
        prizePool.call(
          prizeStrategy,
          'afterWithdrawWithTimelockFrom(address,uint256,address)',
          wallet._address,
          toWei('10'),
          ticket.address
        ))
        .to.be.revertedWith('PrizeStrategy/rng-in-flight')
    })
  })

  describe('estimateCreditAccrualTime()', () => {
    it('should calculate the accrual time', async () => {
      let ticketBalance = toWei('100')
      let interest = toWei('10')
      expect(await prizeStrategy.estimateCreditAccrualTime(
        ticketBalance,
        interest
      )).to.equal(prizePeriodSeconds / exitFeeMantissa)
    })

    it('should calculate the accrual time', async () => {
      let ticketBalance = toWei('100')
      let interest = toWei('30')
      expect(await prizeStrategy.estimateCreditAccrualTime(
        ticketBalance,
        interest
      )).to.equal(prizePeriodSeconds * 3 / exitFeeMantissa)
    })
  })
});
