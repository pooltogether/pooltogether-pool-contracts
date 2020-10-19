const { deployContract } = require('ethereum-waffle')
const { deployMockContract } = require('./helpers/deployMockContract')
const AavePrizePoolHarness = require('../build/AavePrizePoolHarness.json')
const TokenListenerInterface = require('../build/TokenListenerInterface.json')
const ControlledToken = require('../build/ControlledToken.json')
const ATokenInterface = require('../build/ATokenInterface.json')
const LendingPoolAddressesProviderInterface = require('../build/LendingPoolAddressesProviderInterface.json')
const LendingPoolInterface = require('../build/LendingPoolInterface.json')
const LendingPoolMock = require('../build/LendingPoolMock.json')
const IERC20 = require('../build/IERC20.json')
const IERC721 = require('../build/IERC721.json')

const { ethers } = require('ethers')
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:PrizePool.test')

let overrides = { gasLimit: 20000000 }

const FORWARDER = '0x5f48a3371df0F8077EC741Cc2eB31c84a4Ce332a'

describe('AavePrizePool', function() {
  let wallet, wallet2

  let prizePool,
    erc20token,
    erc721token,
    aToken,
    prizeStrategy,
    comptroller,
    lendingPoolAddressesProvider,
    lendingPoolAddress,
    lendingPool

  let poolMaxExitFee = toWei('0.5')
  let poolMaxTimelockDuration = 10000

  let ticket

  let initializeTxPromise

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()
    debug(`using wallet ${wallet._address}`)

    debug('mocking tokens...')
    erc20token = await deployMockContract(wallet, IERC20.abi, overrides)
    erc721token = await deployMockContract(wallet, IERC721.abi, overrides)
    aToken = await deployMockContract(wallet, ATokenInterface.abi, overrides)
    lendingPoolAddressesProvider = await deployMockContract(
      wallet,
      LendingPoolAddressesProviderInterface.abi,
      overrides
    )

    await lendingPoolAddressesProvider.mock.getLendingPool
      .withArgs()
      .returns('0x580D4Fdc4BF8f9b5ae2fb9225D584fED4AD5375c')

    await lendingPoolAddressesProvider.mock.getLendingPoolCore
      .withArgs()
      .returns('0x506B0B2CF20FAA8f38a4E2B524EE43e1f4458Cc5')

    lendingPool = await deployMockContract(
      wallet,
      LendingPoolInterface.abi,
      overrides
    )

    lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()

    // lendingPool = await deployContract(wallet, LendingPoolMock, [lendingPoolAddress], overrides)

    await aToken.mock.underlyingAssetAddress.returns(erc20token.address)

    prizeStrategy = await deployMockContract(wallet, TokenListenerInterface.abi, overrides)
    comptroller = await deployMockContract(wallet, TokenListenerInterface.abi, overrides)

    debug('deploying AavePrizePoolHarness...')
    prizePool = await deployContract(wallet, AavePrizePoolHarness, [], overrides)

    ticket = await deployMockContract(wallet, ControlledToken.abi, overrides)
    await ticket.mock.controller.returns(prizePool.address)

    initializeTxPromise = prizePool[
      'initialize(address,address,address[],uint256,uint256,address,address)'
    ](
      FORWARDER,
      comptroller.address,
      [ticket.address],
      poolMaxExitFee,
      poolMaxTimelockDuration,
      aToken.address,
      lendingPoolAddressesProvider.address,
    )

    await initializeTxPromise

    await prizePool.setPrizeStrategy(prizeStrategy.address)
  })

  describe('initialize()', () => {
    it('should initialize the AavePrizePool', async () => {
      await expect(initializeTxPromise)
        .to.emit(prizePool, 'AavePrizePoolInitialized')
        .withArgs(aToken.address, lendingPoolAddressesProvider.address)

      expect(await prizePool.aTokenAddress()).to.equal(aToken.address)
      expect(await prizePool.lendingPoolAddressesProviderAddress()).to.equal(
        lendingPoolAddressesProvider.address
      )
    })
  })

  describe('_supply()', () => {
    it('should supply assets to aave', async () => {
      let amount = toWei('500')

      const lendingPoolCoreAddress = await lendingPoolAddressesProvider.getLendingPoolCore()


      // const lendingPool = LendingPoolInterface.new(lendingPoolAddress)

      await erc20token.mock.approve.withArgs(lendingPoolCoreAddress, amount).returns(true)
      await lendingPool.mock.deposit.withArgs(lendingPoolAddress, amount, 0).returns()
      await aToken.mock.balanceOf.withArgs(prizePool.address).returns(amount)

      await prizePool.supply(amount)

      expect(await prizePool.callStatic.balance()).to.equal(amount)
    })

    it('should revert on error', async () => {
      let amount = toWei('500')

      await erc20token.mock.approve.withArgs(aToken.address, amount).returns(true)
      await lendingPool.mock.deposit.withArgs(aToken.address, amount, 0).returns(false)

      expect(prizePool.supply(amount)).to.be.reverted()
    })
  })

  describe('_redeem()', () => {
    let amount

    beforeEach(async () => {
      amount = toWei('300')
      await erc20token.mock.approve.withArgs(aToken.address, amount).returns(true)
      await lendingPool.mock.deposit.withArgs(erc20token.address, amount, 0).returns(amount)
      await prizePool.supply(amount)
    })

    it('should redeem assets from Aave', async () => {
      await erc20token.mock.balanceOf.withArgs(prizePool.address).returns(amount)
      await aToken.mock.isTransferAllowed.withArgs(prizePool.address, amount).returns(true);
      await aToken.mock.redeem.withArgs(prizePool.address, toWei('100')).returns(true)
      await erc20token.mock.balanceOf.withArgs(prizePool.address).returns(toWei('200'))

      await prizePool.redeem(amount)
    })
  })

  describe('canAwardExternal()', () => {
    it('should not allow the aToken award', async () => {
      expect(await prizePool.canAwardExternal(aToken.address)).to.be.false
    })
  })

  describe('balance()', () => {
    it('should return the underlying balance', async () => {
      await aToken.mock.balanceOf.withArgs(prizePool.address).returns(toWei('32'))
      expect(await prizePool.callStatic.balance()).to.equal(toWei('32'))
    })
  })

  describe('_token()', () => {
    it('should return the underlying token', async () => {
      expect(await prizePool.token()).to.equal(erc20token.address)
    })
  })
});