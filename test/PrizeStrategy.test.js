const { deployContract } = require('ethereum-waffle')
const { deployMockContract } = require('./helpers/deployMockContract')
const { deploy1820 } = require('deploy-eip-1820')
const GovernorInterface = require('../build/GovernorInterface.json')
const PrizeStrategyHarness = require('../build/PrizeStrategyHarness.json')
const PrizePool = require('../build/PrizePool.json')
const RNGInterface = require('../build/RNGInterface.json')
const IERC20 = require('../build/IERC20.json')
const ControlledToken = require('../build/ControlledToken.json')

const { expect } = require('chai')
const buidler = require('./helpers/buidler')
const toWei = (val) => ethers.utils.parseEther('' + val)
const debug = require('debug')('ptv3:PeriodicPrizePool.test')

const FORWARDER = '0x5f48a3371df0F8077EC741Cc2eB31c84a4Ce332a'

let overrides = { gasLimit: 20000000 }

describe('PrizeStrategy', function() {
  let wallet, wallet2

  let registry, governor, prizePool, prizeStrategy, token

  let ticket, sponsorship, rng

  let prizePeriodSeconds = 1000

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

    debug('deploying prizeStrategy...')
    prizeStrategy = await deployContract(wallet, PrizeStrategyHarness, [], overrides)

    debug('initializing prizeStrategy...')
    await prizeStrategy.initialize(
      FORWARDER,
      governor.address,
      prizePeriodSeconds,
      prizePool.address,
      ticket.address,
      sponsorship.address,
      rng.address,
      []
    )
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
  })

  describe('afterDepositTo()', () => {
    it('should only be called by the prize pool', async () => {
      prizeStrategy2 = await prizeStrategy.connect(wallet2)
      await expect(prizeStrategy2.afterDepositTo(wallet._address, toWei('10'), ticket.address)).to.be.revertedWith('PrizeStrategy/only-prize-pool')
    })

    it('should update the users ticket balance', async () => {
      await prizePool.mock.interestIndexMantissa.returns(toWei('1'))
      await ticket.mock.totalSupply.returns('22')
      await ticket.mock.balanceOf.withArgs(wallet._address).returns(toWei('22'))
      await prizePool.call(prizeStrategy, 'afterDepositTo', wallet._address, toWei('10'), ticket.address)
      expect(await prizeStrategy.draw(1)).to.equal(wallet._address) // they exist in the sortition sum tree
      expect((await prizeStrategy.prizeAverageTickets()).gt('0')).to.be.true // prize average was updated
    })

    it('should not be called if an rng request is in flight', async () => {
      await rng.mock.requestRandomNumber.returns('11');
      await prizeStrategy.setCurrentTime(await prizeStrategy.prizePeriodEndAt());
      await prizeStrategy.startAward();

      await expect(prizePool.call(prizeStrategy, 'afterDepositTo', wallet._address, toWei('10'), ticket.address))
        .to.be.revertedWith('PrizeStrategy/rng-in-flight');
    });
  });

  describe('afterWithdrawInstantlyFrom()', () => {
    it('should revert if rng request is in flight', async () => {
      await rng.mock.requestRandomNumber.returns('11');
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
      await rng.mock.requestRandomNumber.returns('11');
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
      await rng.mock.requestRandomNumber.returns('11');
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
      await rng.mock.requestRandomNumber.returns('11');
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

  describe('estimateAccrualTime()', () => {
    it('should be zero if there was no previous prize', async () => {
      
      let ticketBalance = toWei('100')
      let interest = toWei('10')
      let previousPrize = toWei('0')
      let previousPrizeAverageTickets = toWei('0')
      let prizePeriodSeconds = toWei('10')

      expect(await prizeStrategy.estimateAccrualTime(
        ticketBalance,
        interest,
        previousPrize,
        previousPrizeAverageTickets,
        prizePeriodSeconds
      )).to.equal('0')

    })

    it('should be the maximum if they need the same amount of interest', async () => {
      
      let ticketBalance = toWei('100')
      let interest = toWei('10')
      let previousPrize = toWei('10')
      let previousPrizeAverageTickets = toWei('100')
      let prizePeriodSeconds = '10'

      expect(await prizeStrategy.estimateAccrualTime(
        ticketBalance,
        interest,
        previousPrize,
        previousPrizeAverageTickets,
        prizePeriodSeconds
      )).to.equal('10')

    })

    it('should be half if they have half the credit', async () => {
      
      let ticketBalance = toWei('100')
      let interest = toWei('5')
      let previousPrize = toWei('10')
      let previousPrizeAverageTickets = toWei('100')
      let prizePeriodSeconds = '10'

      expect(await prizeStrategy.estimateAccrualTime(
        ticketBalance,
        interest,
        previousPrize,
        previousPrizeAverageTickets,
        prizePeriodSeconds
      )).to.equal('5')

    })

    it('should be double if they require twice as much interest', async () => {
      
      let ticketBalance = toWei('100')
      let interest = toWei('20')
      let previousPrize = toWei('10')
      let previousPrizeAverageTickets = toWei('100')
      let prizePeriodSeconds = '10'

      expect(await prizeStrategy.estimateAccrualTime(
        ticketBalance,
        interest,
        previousPrize,
        previousPrizeAverageTickets,
        prizePeriodSeconds
      )).to.equal('20')

    })
  })
});
