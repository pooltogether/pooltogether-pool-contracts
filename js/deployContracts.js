const PeriodicPrizePoolFactory = require('../build/PeriodicPrizePoolFactory.json')
const RNGBlockhash = require('../build/RNGBlockhash.json')
const Forwarder = require('../build/Forwarder.json')
const MockGovernor = require('../build/MockGovernor.json')
const CompoundYieldServiceFactory = require('../build/CompoundYieldServiceFactory.json')
const PrizePoolModuleManagerFactory = require('../build/PrizePoolModuleManagerFactory.json')
const PrizePoolBuilder = require('../build/PrizePoolBuilder.json')
const CreditFactory = require('../build/CreditFactory.json')
const InterestTrackerFactory = require('../build/InterestTrackerFactory.json')
const SingleRandomWinnerPrizePoolBuilder = require('../build/SingleRandomWinnerPrizePoolBuilder.json')
const TicketFactory = require('../build/TicketFactory.json')
const SponsorshipFactory = require('../build/SponsorshipFactory.json')
const TimelockFactory = require('../build/TimelockFactory.json')
const SingleRandomWinnerPrizeStrategyFactory = require('../build/SingleRandomWinnerPrizeStrategyFactory.json')
const CTokenMock = require('../build/CTokenMock.json')
const ERC20Mintable = require('../build/ERC20Mintable.json')

const ethers = require('ethers')
const { deploy1820 } = require('deploy-eip-1820')
const { deployContract } = require('ethereum-waffle')

const debug = require('debug')('ptv3:deployContracts')

async function deployContracts(wallet, overrides = { gasLimit: 20000000 }) {
  let registry = await deploy1820(wallet)

  debug('beforeEach deploy rng, forwarder etc...')

  let rng = await deployContract(wallet, RNGBlockhash, [], overrides)
  let forwarder = await deployContract(wallet, Forwarder, [], overrides)
  let token = await deployContract(wallet, ERC20Mintable, [], overrides)
  let cToken = await deployContract(wallet, CTokenMock, [
    token.address, ethers.utils.parseEther('0.01')
  ], overrides)

  debug('deploying protocol governor...')

  let governor = await deployContract(wallet, MockGovernor, [], overrides)

  debug('deploying PrizePoolModuleManagerFactory')

  let ownableModuleManagerFactory = await deployContract(wallet, PrizePoolModuleManagerFactory, [], overrides)
  await ownableModuleManagerFactory.initialize(overrides)

  debug('deploying compound yield service factory')

  let yieldServiceFactory = await deployContract(wallet, CompoundYieldServiceFactory, [], overrides)
  await yieldServiceFactory.initialize(overrides)

  debug('deploying prize pool factory')

  let prizePoolFactory = await deployContract(wallet, PeriodicPrizePoolFactory, [], overrides)
  await prizePoolFactory.initialize(overrides)

  debug('deployed timelock factory')

  let timelockFactory = await deployContract(wallet, TimelockFactory, [], overrides)
  await timelockFactory.initialize(overrides)
  
  debug('deployed ticket factory')

  let ticketFactory = await deployContract(wallet, TicketFactory, [], overrides)
  await ticketFactory.initialize(overrides)
  
  debug('deploying prize strategy factory')

  let prizeStrategyFactory = await deployContract(wallet, SingleRandomWinnerPrizeStrategyFactory, [], overrides)
  await prizeStrategyFactory.initialize(overrides)
  
  debug('deploying credit factory')

  let creditFactory = await deployContract(wallet, CreditFactory, [], overrides)
  await creditFactory.initialize(overrides)

  debug('deploying interest tracker factory')

  let interestTrackerFactory = await deployContract(wallet, InterestTrackerFactory, [], overrides)
  await interestTrackerFactory.initialize(overrides)

  debug('deploying sponsorship factory')

  let sponsorshipFactory = await deployContract(wallet, SponsorshipFactory, [], overrides)
  await sponsorshipFactory.initialize(overrides)

  debug('deploying prize pool builder')

  let prizePoolBuilder = await deployContract(wallet, PrizePoolBuilder, [], overrides)
  await prizePoolBuilder.initialize(
    ownableModuleManagerFactory.address,
    governor.address,
    yieldServiceFactory.address,
    prizePoolFactory.address,
    ticketFactory.address,
    timelockFactory.address,
    sponsorshipFactory.address,
    creditFactory.address,
    interestTrackerFactory.address,
    rng.address,
    forwarder.address,
    overrides
  )

  debug('deploying single random winner prize pool builder')

  let singleRandomWinnerPrizePoolBuilder = await deployContract(wallet, SingleRandomWinnerPrizePoolBuilder, [], overrides)
  await singleRandomWinnerPrizePoolBuilder.initialize(
    prizePoolBuilder.address,
    prizeStrategyFactory.address,
    overrides
  )

  debug('deployContracts complete!')

  return {
    rng,
    registry,
    forwarder,
    token,
    cToken,
    governor,
    ownableModuleManagerFactory,
    yieldServiceFactory,
    prizePoolFactory,
    timelockFactory,
    ticketFactory,
    prizeStrategyFactory,
    creditFactory,
    sponsorshipFactory,
    prizePoolBuilder,
    interestTrackerFactory,
    singleRandomWinnerPrizePoolBuilder
  }
}

module.exports = {
  deployContracts
}