const { deployContract, deployMockContract } = require('ethereum-waffle')
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
  })

  describe('with a mocked PrizeStrategy', () =>{ 
    beforeEach(async () => {
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
  })

  describe('afterDepositTo()', () => {
    beforeEach(async () => {
      await prizeStrategy.initialize(
        FORWARDER,
        governor.address,
        prizePeriodSeconds,
        wallet._address, // here we make it so we are the prize pool
        ticket.address,
        sponsorship.address,
        rng.address
      )
    })

    it('should only be called by the prize pool', async () => {
      prizeStrategy2 = await prizeStrategy.connect(wallet2)
      await expect(prizeStrategy2.afterDepositTo(wallet._address, toWei('10'), ticket.address)).to.be.revertedWith('PrizeStrategy/only-prize-pool')
    })

    xit('should update the users ticket balance', async () => {
      debug("got here1")
      await ticket.mock.balanceOf.withArgs(wallet._address).returns(toWei('22'))
      debug("got here2")
      await prizeStrategy.afterDepositTo(wallet._address, toWei('10'), ticket.address)
      debug("got here3")
      expect(await prizeStrategy.draw(1)).to.equal(wallet._address) // they exist in the sortition sum tree
      debug("got here54")
      expect((await prizeStrategy.prizeAverageTickets()).gt('0')).to.be.true // prize average was updated
    })
  })
});
