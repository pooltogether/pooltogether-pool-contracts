const { deployMockContract } = require('ethereum-waffle')
const { ethers } = require('ethers')
const { expect } = require('chai')
const hardhat = require('hardhat')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:YieldSourcePrizePool.test')

let overrides = { gasLimit: 9500000 }

describe('YieldSourcePrizePool', function() {
  let wallet, wallet2

  let prizePool, erc20token, prizeStrategy, reserveRegistry, yieldSource

  let poolMaxExitFee = toWei('0.5')
  let poolMaxTimelockDuration = 10000

  let ticket

  let initializeTxPromise

  beforeEach(async () => {
    [wallet, wallet2] = await hardhat.ethers.getSigners()
    debug(`using wallet ${wallet.address}`)

    debug('creating token...')
    const ERC20MintableContract =  await hre.ethers.getContractFactory("ERC20Mintable", wallet, overrides)
    erc20token = await ERC20MintableContract.deploy("Token", "TOKE")

    debug('creating yield source mock...')
    const YieldSourceInterface = await hre.artifacts.readArtifact("YieldSourceInterface")
    yieldSource =  await deployMockContract(wallet, YieldSourceInterface.abi, overrides)
    yieldSource.mock.token.returns(erc20token.address)

    const TokenListenerInterface = await hre.artifacts.readArtifact("TokenListenerInterface")
    prizeStrategy = await deployMockContract(wallet, TokenListenerInterface.abi, overrides)
    await prizeStrategy.mock.supportsInterface.returns(true)
    await prizeStrategy.mock.supportsInterface.withArgs('0xffffffff').returns(false)

    const RegistryInterface = await hre.artifacts.readArtifact("RegistryInterface")
    reserveRegistry = await deployMockContract(wallet, RegistryInterface.abi, overrides)

    debug('deploying YieldSourcePrizePoolHarness...')
    const YieldSourcePrizePoolHarness =  await hre.ethers.getContractFactory("YieldSourcePrizePoolHarness", wallet, overrides)
    prizePool = await YieldSourcePrizePoolHarness.deploy()

    const ControlledToken = await hre.artifacts.readArtifact("ControlledToken")
    ticket = await deployMockContract(wallet, ControlledToken.abi, overrides)
    await ticket.mock.controller.returns(prizePool.address)

    initializeTxPromise = prizePool.initializeYieldSourcePrizePool(
      reserveRegistry.address,
      [ticket.address],
      poolMaxExitFee,
      poolMaxTimelockDuration,
      yieldSource.address
    )

    await initializeTxPromise

    await prizePool.setPrizeStrategy(prizeStrategy.address)
  })

  describe('initialize()', () => {
    it('should initialize correctly', async () => {
      await expect(initializeTxPromise)
        .to.emit(prizePool, 'YieldSourcePrizePoolInitialized')
        .withArgs(
          yieldSource.address
        )

      expect(await prizePool.yieldSource()).to.equal(yieldSource.address)
    })
  })

  describe('supply()', async () => {
    it('should supply assets to the yield source', async () => {
      await erc20token.mint(prizePool.address, toWei('10'))
      await yieldSource.mock.supplyTo.withArgs(toWei('10'), prizePool.address).returns()
      await prizePool.supply(toWei('10'))
    })
  })

  describe('redeem()', async () => {
    it('should redeem assets from the yield source', async () => {
      await yieldSource.mock.redeem.withArgs(toWei('99')).returns('98')
      expect(await prizePool.callStatic.redeem(toWei('99'))).to.equal('98')
    })
  })

  describe('token()', async () => {
    it('should return the yield source token', async () => {
      expect(await prizePool.token()).to.equal(erc20token.address)
    })
  })

  describe('canAwardExternal()', async () => {
    it('should not allow the prize pool to award its token, as its likely the receipt', async () => {
      expect(await prizePool.canAwardExternal(yieldSource.address)).to.equal(false)
    })
  })
})
