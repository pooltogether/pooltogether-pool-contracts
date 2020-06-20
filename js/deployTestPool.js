const CompoundPeriodicPrizePoolHarness = require('../build/CompoundPeriodicPrizePoolHarness.json')
const RNGServiceMock = require('../build/RNGServiceMock.json')
const Forwarder = require('../build/Forwarder.json')
const MockGovernor = require('../build/MockGovernor.json')
const Ticket = require('../build/Ticket.json')
const ControlledToken = require('../build/ControlledToken.json')
const SingleRandomWinnerPrizeStrategy = require('../build/SingleRandomWinnerPrizeStrategy.json')
const CTokenMock = require('../build/CTokenMock.json')
const ERC20Mintable = require('../build/ERC20Mintable.json')

const ethers = require('ethers')
const { deploy1820 } = require('deploy-eip-1820')
const { deployContract } = require('ethereum-waffle')

const debug = require('debug')('ptv3:deployTestPool')

async function deployTestPool(wallet, prizePeriodSeconds, overrides = { gasLimit: 20000000 }) {
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
  let prizeStrategy = await deployContract(wallet, SingleRandomWinnerPrizeStrategy, [], overrides)
  await prizeStrategy.initialize(
    forwarder.address,
    rng.address
  )
  
  let prizePool = await deployContract(wallet, CompoundPeriodicPrizePoolHarness, [], overrides)

  await prizePool.initialize(
    forwarder.address,
    governor.address,
    prizeStrategy.address,
    prizePeriodSeconds,
    cToken.address
  );

  let sponsorship = await deployContract(wallet, ControlledToken, [], overrides)
  await sponsorship.initialize("Sponsorship", "SPON", [], forwarder.address, prizePool.address)

  let sponsorshipCredit = await deployContract(wallet, ControlledToken, [], overrides)
  await sponsorshipCredit.initialize("Sponsorship Credit", "SCRED", [], forwarder.address, prizePool.address)

  let ticket = await deployContract(wallet, Ticket, [], overrides)
  await ticket.initialize("Ticket", "TICK", [], forwarder.address, prizePool.address)

  let ticketCredit = await deployContract(wallet, ControlledToken, [], overrides)
  await ticketCredit.initialize("Ticket Credit", "TCRED", [], forwarder.address, prizePool.address)

  await prizePool.setTokens(
    ticket.address,
    sponsorship.address,
    ticketCredit.address,
    sponsorshipCredit.address
  )

  debug("Addresses: \n", {
    rng: rng.address,
    registry: registry.address,
    forwarder: forwarder.address,
    token: token.address,
    cToken: cToken.address,
    governor: governor.address,
    prizePool: prizePool.address,
    ticket: ticket.address,
    sponsorship: sponsorship.address,
    ticketCredit: ticketCredit.address,
    sponsorshipCredit: sponsorshipCredit.address,
    prizeStrategy: prizeStrategy.address
  })

  return {
    rng,
    registry,
    forwarder,
    token,
    cToken,
    governor,
    prizePool,
    ticket,
    sponsorship,
    ticketCredit,
    sponsorshipCredit,
    prizeStrategy
  }
}

module.exports = {
  deployTestPool
}