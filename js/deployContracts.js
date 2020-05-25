const PeriodicPrizePoolFactory = require('../build/PeriodicPrizePoolFactory.json')
const RNGBlockhash = require('../build/RNGBlockhash.json')
const Forwarder = require('../build/Forwarder.json')
const ProtocolGovernor = require('../build/ProtocolGovernor.json')
const CompoundYieldServiceFactory = require('../build/CompoundYieldServiceFactory.json')
const OwnableModuleManagerFactory = require('../build/OwnableModuleManagerFactory.json')
const PrizePoolBuilder = require('../build/PrizePoolBuilder.json')
const LoyaltyFactory = require('../build/LoyaltyFactory.json')
const SingleRandomWinnerPrizePoolBuilder = require('../build/SingleRandomWinnerPrizePoolBuilder.json')
const TicketFactory = require('../build/TicketFactory.json')
const SponsorshipFactory = require('../build/SponsorshipFactory.json')
const TimelockFactory = require('../build/TimelockFactory.json')
const SingleRandomWinnerPrizeStrategyFactory = require('../build/SingleRandomWinnerPrizeStrategyFactory.json')
const CTokenMock = require('../build/CTokenMock.json')
const ERC20Mintable = require('../build/ERC20Mintable.json')

const { deploy1820 } = require('deploy-eip-1820')
const { deployContract } = require('ethereum-waffle')

const debug = require('debug')('ptv3:deployContracts')

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

async function deployContracts(wallet, overrides = { gasLimit: 7000000 }) {
  let registry = await deploy1820(wallet)

  debug('beforeEach deploy rng, forwarder etc...')

  let rng = await deployContract(wallet, RNGBlockhash, [])
  let forwarder = await deployContract(wallet, Forwarder, [])
  let token = await deployContract(wallet, ERC20Mintable, [])
  let cToken = await deployContract(wallet, CTokenMock, [
    token.address, ethers.utils.parseEther('0.01')
  ])

  debug('deploying protocol governor...')

  let protocolGovernor = await deployContract(wallet, ProtocolGovernor, [])
  await protocolGovernor.initialize('0', ZERO_ADDRESS)

  debug('deploying OwnableModuleManagerFactory')

  let ownableModuleManagerFactory = await deployContract(wallet, OwnableModuleManagerFactory, [])
  await ownableModuleManagerFactory.initialize()

  debug('deploying compound yield service factory')

  let yieldServiceFactory = await deployContract(wallet, CompoundYieldServiceFactory, [])
  await yieldServiceFactory.initialize()

  debug('deploying prize pool factory')

  let prizePoolFactory = await deployContract(wallet, PeriodicPrizePoolFactory, [], overrides)
  await prizePoolFactory.initialize()

  debug('deployed timelock factory')

  let timelockFactory = await deployContract(wallet, TimelockFactory, [])
  await timelockFactory.initialize()
  
  debug('deployed ticket factory')

  let ticketFactory = await deployContract(wallet, TicketFactory, [], overrides)
  await ticketFactory.initialize()
  
  debug('deploying prize strategy factory')

  let prizeStrategyFactory = await deployContract(wallet, SingleRandomWinnerPrizeStrategyFactory, [])
  await prizeStrategyFactory.initialize()
  
  debug('deploying loyalty factory')

  let loyaltyFactory = await deployContract(wallet, LoyaltyFactory, [])
  await loyaltyFactory.initialize()

  debug('deploying sponsorship factory')

  let sponsorshipFactory = await deployContract(wallet, SponsorshipFactory, [])
  await sponsorshipFactory.initialize()

  debug('deploying prize pool builder')

  let prizePoolBuilder = await deployContract(wallet, PrizePoolBuilder, [])
  await prizePoolBuilder.initialize(
    ownableModuleManagerFactory.address,
    protocolGovernor.address,
    yieldServiceFactory.address,
    prizePoolFactory.address,
    ticketFactory.address,
    timelockFactory.address,
    sponsorshipFactory.address,
    loyaltyFactory.address,
    rng.address,
    forwarder.address
  )
  
  debug('deploying single random winner prize pool builder')

  let singleRandomWinnerPrizePoolBuilder = await deployContract(wallet, SingleRandomWinnerPrizePoolBuilder, [])
  await singleRandomWinnerPrizePoolBuilder.initialize(
    prizePoolBuilder.address,
    prizeStrategyFactory.address
  )

  return {
    rng,
    registry,
    forwarder,
    token,
    cToken,
    protocolGovernor,
    ownableModuleManagerFactory,
    yieldServiceFactory,
    prizePoolFactory,
    timelockFactory,
    ticketFactory,
    prizeStrategyFactory,
    loyaltyFactory,
    sponsorshipFactory,
    prizePoolBuilder,
    singleRandomWinnerPrizePoolBuilder
  }
}

module.exports = {
  deployContracts
}