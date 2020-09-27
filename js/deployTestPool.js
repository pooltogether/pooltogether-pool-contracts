const { deployments } = require("@nomiclabs/buidler");
const buidler = require('@nomiclabs/buidler')
const ERC20Mintable = require('../build/ERC20Mintable.json')

const ethers = require('ethers')
const { AddressZero } = ethers.constants;
const { deployContract } = require('ethereum-waffle')

const toWei = (val) => ethers.utils.parseEther('' + val)

const debug = require('debug')('ptv3:deployTestPool')

async function getEvents(tx, builder) {
  let receipt = await buidler.ethers.provider.getTransactionReceipt(tx.hash)
  return receipt.logs.reduce((parsedEvents, log) => {
    try {
      parsedEvents.push(builder.interface.parseLog(log))
    } catch (e) {}
    return parsedEvents
  }, [])
}

async function deployTestPool({
  wallet,
  prizePeriodStart = 0,
  prizePeriodSeconds,
  maxExitFeeMantissa,
  maxTimelockDuration,
  creditLimit,
  creditRate,
  externalERC20Awards,
  yVault,
  overrides = { gasLimit: 20000000 }
}) {
  await deployments.fixture()

  debug('beforeEach deploy rng, forwarder etc...')

  /* = await deployContract(wallet, CTokenMock, [
    token.address, ethers.utils.parseEther('0.01')
  ], overrides)*/

  debug('Deploying Governor...')

  let governanceToken = await deployContract(wallet, ERC20Mintable, ['Governance Token', 'GOV'], overrides)

  let yVaultBuilderResult = await deployments.get("yVaultPrizePoolBuilder")
  let compoundBuilderResult = await deployments.get("CompoundPrizePoolBuilder")
  let comptrollerResult = await deployments.get("Comptroller")
  let rngServiceMockResult = await deployments.get("RNGServiceMock")
  let tokenResult = await deployments.get("Dai")
  let cTokenResult = await deployments.get("cDai")
  let yTokenResult = await deployments.get("yDai")

  const token = await buidler.ethers.getContractAt('ERC20Mintable', tokenResult.address, wallet)
  const cToken = await buidler.ethers.getContractAt('CTokenMock', cTokenResult.address, wallet)
  const yToken = await buidler.ethers.getContractAt('yVaultMock', yTokenResult.address, wallet)
  const comptroller = await buidler.ethers.getContractAt('ComptrollerHarness', comptrollerResult.address, wallet)

  let linkToken = await deployContract(wallet, ERC20Mintable, ['Link Token', 'LINK'], overrides)
  let rngServiceMock = await buidler.ethers.getContractAt('RNGServiceMock', rngServiceMockResult.address, wallet)
  await rngServiceMock.setRequestFee(linkToken.address, toWei('1'))

  const singleRandomWinnerConfig = {
    proxyAdmin: AddressZero,
    rngService: rngServiceMock.address,
    prizePeriodStart,
    prizePeriodSeconds,
    ticketName: "Ticket",
    ticketSymbol: "TICK",
    sponsorshipName: "Sponsorship",
    sponsorshipSymbol: "SPON",
    ticketCreditLimitMantissa: creditLimit,
    ticketCreditRateMantissa: creditRate,
    externalERC20Awards
  }

  let prizePool
  if (yVault) {
    debug(`Creating yVault prize pool config: ${yTokenResult.address}`)
    const yToken = await buidler.ethers.getContractAt('yVaultMock', yTokenResult.address, wallet)
    debug(`yToken token: ${await yToken.token()} and token ${token.address}`)
    const yVaultPrizePoolConfig = {
      vault: yTokenResult.address,
      reserveRateMantissa: toWei('0.05'),
      maxExitFeeMantissa,
      maxTimelockDuration
    }
    debug(`Loading yVaultPrizePool Builder ${yVaultBuilderResult.address}`)
    const builder = await buidler.ethers.getContractAt('yVaultPrizePoolBuilder', yVaultBuilderResult.address, wallet)
    debug(`creating single random winner: `, yVaultPrizePoolConfig, singleRandomWinnerConfig)
    let tx = await builder.createSingleRandomWinner(yVaultPrizePoolConfig, singleRandomWinnerConfig, await token.decimals())
    let events = await getEvents(tx, builder)
    let event = events[0]
    prizePool = await buidler.ethers.getContractAt('yVaultPrizePoolHarness', event.args.prizePool, wallet)
  } else {
    const compoundPrizePoolConfig = {
      cToken: cTokenResult.address,
      maxExitFeeMantissa,
      maxTimelockDuration
    }
    const builder = await buidler.ethers.getContractAt('CompoundPrizePoolBuilder', compoundBuilderResult.address, wallet)
    let tx = await builder.createSingleRandomWinner(compoundPrizePoolConfig, singleRandomWinnerConfig, await token.decimals())
    let events = await getEvents(tx, builder)
    let event = events[0]
    prizePool = await buidler.ethers.getContractAt('CompoundPrizePoolHarness', event.args.prizePool, wallet)
  }


  debug("created prizePool: ", prizePool.address)

  let sponsorship = await buidler.ethers.getContractAt('ControlledToken', (await prizePool.tokens())[0], wallet)
  let ticket = await buidler.ethers.getContractAt('Ticket', (await prizePool.tokens())[1], wallet)

  debug(`sponsorship: ${sponsorship.address}, ticket: ${ticket.address}`)

  await prizePool.setCreditPlanOf(ticket.address, creditRate || toWei('0.1').div(prizePeriodSeconds), creditLimit || toWei('0.1'))

  const prizeStrategyAddress = await prizePool.prizeStrategy()

  debug("Addresses: \n", {
    rngService: rngServiceMock.address,
    token: tokenResult.address,
    cToken: cTokenResult.address,
    comptroller: comptrollerResult.address,
    ticket: ticket.address,
    prizePool: prizePool.address,
    sponsorship: sponsorship.address,
    prizeStrategy: prizeStrategyAddress,
    governanceToken: governanceToken.address
  })

  const prizeStrategy = await buidler.ethers.getContractAt('SingleRandomWinnerHarness', prizeStrategyAddress, wallet)

  return {
    rngService: rngServiceMock,
    token,
    cToken,
    yToken,
    comptroller,
    prizeStrategy,
    prizePool,
    ticket,
    sponsorship,
    governanceToken
  }
}

module.exports = {
  deployTestPool
}