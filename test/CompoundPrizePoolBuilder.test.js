const { deployments } = require("@nomiclabs/buidler");
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')
const { ethers } = require('ethers')
const { AddressZero } = ethers.constants
const { deployMockContract } = require('./helpers/deployMockContract')
const TokenListenerInterface = require('../build/TokenListenerInterface.json')
const { getEvents } = require('./helpers/getEvents')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:CompoundPrizePoolBuilder.test')

describe('CompoundPrizePoolBuilder', () => {

  let wallet

  let builder

  let reserveRegistry,
      compoundPrizePoolProxyFactory,
      cToken

  let compoundPrizePoolConfig

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()
    await deployments.fixture()
    builder = await buidler.ethers.getContractAt(
      "CompoundPrizePoolBuilder",
      (await deployments.get("CompoundPrizePoolBuilder")).address,
      wallet
    )

    reserveRegistry = (await deployments.get("ReserveRegistry"))
    compoundPrizePoolProxyFactory = (await deployments.get("CompoundPrizePoolProxyFactory"))
    cToken = (await deployments.get("cDai"))

    compoundPrizePoolConfig = {
      cToken: cToken.address,
      maxExitFeeMantissa: toWei('0.5'),
      maxTimelockDuration: 1000
    }

  })

  describe('initialize()', () => {
    it('should setup all factories', async () => {
      expect(await builder.reserveRegistry()).to.equal(reserveRegistry.address)
      expect(await builder.compoundPrizePoolProxyFactory()).to.equal(compoundPrizePoolProxyFactory.address)
    })
  })

  describe('createCompoundPrizePool()', () => {
    it('should allow a user to create a CompoundPrizePool', async () => {
      const prizeStrategy = await deployMockContract(wallet, TokenListenerInterface.abi)

      let tx = await builder.createCompoundPrizePool(compoundPrizePoolConfig)
      let events = await getEvents(builder, tx)
      let event = events[0]

      expect(event.name).to.equal('PrizePoolCreated')

      const prizePool = await buidler.ethers.getContractAt('CompoundPrizePoolHarness', event.args.prizePool, wallet)

      expect(await prizePool.cToken()).to.equal(compoundPrizePoolConfig.cToken)
      expect(await prizePool.maxExitFeeMantissa()).to.equal(compoundPrizePoolConfig.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(compoundPrizePoolConfig.maxTimelockDuration)
      expect(await prizePool.owner()).to.equal(wallet._address)
      expect(await prizePool.prizeStrategy()).to.equal(AddressZero)
    })
  })
})
