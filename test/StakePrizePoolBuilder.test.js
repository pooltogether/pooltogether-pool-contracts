const { deployments } = require("@nomiclabs/buidler");
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')
const { ethers } = require('ethers')
const { AddressZero } = ethers.constants
const { getEvents } = require('./helpers/getEvents')

const toWei = ethers.utils.parseEther

describe('StakePrizePoolBuilder', () => {

  let wallet

  let builder

  let reserveRegistry,
      trustedForwarder,
      stakePrizePoolProxyFactory,
      rngServiceMock,
      token

  let stakePrizePoolConfig

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()
    await deployments.fixture()
    builder = await buidler.ethers.getContractAt(
      "StakePrizePoolBuilder",
      (await deployments.get("StakePrizePoolBuilder")).address,
      wallet
    )

    reserveRegistry = (await deployments.get("ReserveRegistry"))
    trustedForwarder = (await deployments.get("TrustedForwarder"))
    stakePrizePoolProxyFactory = (await deployments.get("StakePrizePoolProxyFactory"))
    token = (await deployments.get("Dai"))

    stakePrizePoolConfig = {
      token: token.address,
      maxExitFeeMantissa: toWei('0.5'),
      maxTimelockDuration: 1000
    }

  })

  describe('initialize()', () => {
    it('should setup all factories', async () => {
      expect(await builder.reserveRegistry()).to.equal(reserveRegistry.address)
      expect(await builder.trustedForwarder()).to.equal(trustedForwarder.address)
      expect(await builder.stakePrizePoolProxyFactory()).to.equal(stakePrizePoolProxyFactory.address)
    })
  })

  describe('createStakePrizePool()', () => {
    it('should allow a user to create a StakePrizePool', async () => {
      let tx = await builder.createStakePrizePool(stakePrizePoolConfig)
      let events = await getEvents(builder, tx)
      let event = events[0]

      expect(event.name).to.equal('PrizePoolCreated')

      const prizePool = await buidler.ethers.getContractAt('StakePrizePool', event.args.prizePool, wallet)

      expect(await prizePool.token()).to.equal(stakePrizePoolConfig.token)
      expect(await prizePool.maxExitFeeMantissa()).to.equal(stakePrizePoolConfig.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(stakePrizePoolConfig.maxTimelockDuration)
      expect(await prizePool.owner()).to.equal(wallet._address)
      expect(await prizePool.prizeStrategy()).to.equal(AddressZero)
    })
  })
})
