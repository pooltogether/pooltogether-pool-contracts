const { deployments } = require("@nomiclabs/buidler");
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')
const { ethers } = require('ethers')
const { AddressZero } = ethers.constants
const { deployMockContract } = require('./helpers/deployMockContract')
const TokenListenerInterface = require('../build/TokenListenerInterface.json')

const toWei = ethers.utils.parseEther

describe('VaultPrizePoolBuilder', () => {

  let wallet, env

  let builder

  let reserveRegistry,
      trustedForwarder,
      vaultPrizePoolProxyFactory,
      vault

  let vaultPrizePoolConfig

  beforeEach(async () => {
    [wallet] = await buidler.ethers.getSigners()
    await deployments.fixture()
    builder = await buidler.ethers.getContractAt(
      "VaultPrizePoolBuilder",
      (await deployments.get("VaultPrizePoolBuilder")).address,
      wallet
    )

    reserveRegistry = (await deployments.get("ReserveRegistry"))
    trustedForwarder = (await deployments.get("TrustedForwarder"))
    vaultPrizePoolProxyFactory = (await deployments.get("yVaultPrizePoolProxyFactory"))
    vault = (await deployments.get("yDai"))

    vaultPrizePoolConfig = {
      vault: vault.address,
      reserveRateMantissa: toWei('0.05'),
      maxExitFeeMantissa: toWei('0.5'),
      maxTimelockDuration: 1000
    }

  })

  describe('initialize()', () => {
    it('should setup all factories', async () => {
      expect(await builder.reserveRegistry()).to.equal(reserveRegistry.address)
      expect(await builder.trustedForwarder()).to.equal(trustedForwarder.address)
      expect(await builder.vaultPrizePoolProxyFactory()).to.equal(vaultPrizePoolProxyFactory.address)
    })
  })

  async function getEvents(tx) {
    let receipt = await buidler.ethers.provider.getTransactionReceipt(tx.hash)
    return receipt.logs.reduce((parsedEvents, log) => {
      try {
        parsedEvents.push(builder.interface.parseLog(log))
      } catch (e) {}
      return parsedEvents
    }, [])
  }

  describe('createVaultPrizePool()', () => {
    it('should allow a user to create a yVaultPrizePool', async () => {
      const prizeStrategy = await deployMockContract(wallet, TokenListenerInterface.abi)

      let tx = await builder.createVaultPrizePool(vaultPrizePoolConfig)
      let events = await getEvents(tx)
      let event = events[0]

      expect(event.name).to.equal('PrizePoolCreated')

      const prizePool = await buidler.ethers.getContractAt('yVaultPrizePoolHarness', event.args.prizePool, wallet)

      expect(await prizePool.vault()).to.equal(vaultPrizePoolConfig.vault)
      expect(await prizePool.maxExitFeeMantissa()).to.equal(vaultPrizePoolConfig.maxExitFeeMantissa)
      expect(await prizePool.maxTimelockDuration()).to.equal(vaultPrizePoolConfig.maxTimelockDuration)
      expect(await prizePool.owner()).to.equal(wallet._address)
      expect(await prizePool.prizeStrategy()).to.equal(AddressZero)
    })
  })
})
