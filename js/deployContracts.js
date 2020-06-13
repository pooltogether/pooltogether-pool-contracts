const CompoundPeriodicPrizePoolFactory = require('../build/CompoundPeriodicPrizePoolFactory.json')
const RNGServiceMock = require('../build/RNGServiceMock.json')
const Forwarder = require('../build/Forwarder.json')
const MockGovernor = require('../build/MockGovernor.json')
const PrizePoolBuilder = require('../build/PrizePoolBuilder.json')
const SingleRandomWinnerPrizePoolBuilder = require('../build/SingleRandomWinnerPrizePoolBuilder.json')
const TicketFactory = require('../build/TicketFactory.json')
const ControlledTokenFactory = require('../build/ControlledTokenFactory.json')
// const TimelockFactory = require('../build/TimelockFactory.json')
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

  let rng = await deployContract(wallet, RNGServiceMock, [], overrides)
  let forwarder = await deployContract(wallet, Forwarder, [], overrides)
  let token = await deployContract(wallet, ERC20Mintable, [], overrides)
  let cToken = await deployContract(wallet, CTokenMock, [
    token.address, ethers.utils.parseEther('0.01')
  ], overrides)

  debug('deploying protocol governor...')

  let governor = await deployContract(wallet, MockGovernor, [], overrides)

  // debug('deploying compound yield service factory')

  // let yieldServiceFactory = await deployContract(wallet, CompoundYieldServiceFactory, [], overrides)
  // await yieldServiceFactory.initialize(overrides)

  debug('deploying prize pool factory')

  let prizePoolFactory = await deployContract(wallet, CompoundPeriodicPrizePoolFactory, [], overrides)
  await prizePoolFactory.initialize(overrides)

  // debug('deployed timelock factory')

  // let timelockFactory = await deployContract(wallet, TimelockFactory, [], overrides)
  // await timelockFactory.initialize(overrides)
  
  debug('deployed ticket factory')

  let ticketFactory = await deployContract(wallet, TicketFactory, [], overrides)
  await ticketFactory.initialize(overrides)
  
  debug('deploying prize strategy factory')

  let prizeStrategyFactory = await deployContract(wallet, SingleRandomWinnerPrizeStrategyFactory, [], overrides)
  await prizeStrategyFactory.initialize(overrides)
  
  // debug('deploying interest tracker factory')

  // let interestTrackerFactory = await deployContract(wallet, InterestTrackerFactory, [], overrides)
  // await interestTrackerFactory.initialize(overrides)

  debug('deploying sponsorship factory')

  let controlledTokenFactory = await deployContract(wallet, ControlledTokenFactory, [], overrides)
  await controlledTokenFactory.initialize(overrides)

  debug('deploying prize pool builder')

  let prizePoolBuilder = await deployContract(wallet, PrizePoolBuilder, [], overrides)
  await prizePoolBuilder.initialize(
    governor.address,
    prizePoolFactory.address,
    ticketFactory.address,
    controlledTokenFactory.address,
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
    prizePoolFactory,
    ticketFactory,
    prizeStrategyFactory,
    controlledTokenFactory,
    prizePoolBuilder,
    singleRandomWinnerPrizePoolBuilder
  }
}

module.exports = {
  deployContracts
}